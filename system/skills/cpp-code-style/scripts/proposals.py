"""Reviewable mutations with explicit scope, digest confirmation and stale checks."""
from copy import deepcopy
import difflib
import json
from pathlib import Path
import os
import tempfile

from core import (LAYERS, RuleError, Store, detail_path, digest, dump, file_hash,
                  parse, validate_index, validate_config)
from handlers import export_format


def write_atomic(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=".cpp-style-", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def propose(store, layer, incoming=None, unset=(), base_style=None, with_format=False, executable="clang-format"):
    store.validate()
    root = store.roots[layer].resolve()
    document = deepcopy(store.documents[layer])
    items = {item["id"]: item for item in document["rules"]}
    details = {}
    touched = []
    if incoming:
        input_path = Path(incoming).resolve()
        data = parse(input_path.read_text(encoding="utf-8"))
        validate_index(data, layer)
        if layer == "system":
            document["profile"] = deepcopy(data["profile"])
        for item in data["rules"]:
            full = deepcopy(item)
            if "detail" in item:
                path = detail_path(input_path.parent, item["detail"])
                body = parse(path.read_text(encoding="utf-8"))
                if not isinstance(body, dict) or set(body) != {"id", "config"} or body["id"] != item["id"]:
                    raise RuleError(f"Invalid incoming detail: {path}")
                full["config"] = body["config"]
                details[str(detail_path(root, item["detail"]))] = dump(body)
            validate_config(full)
            items[item["id"]] = item
            touched.append(item["id"])
        for key in ("baseStyle", "toolchain"):
            if key in data:
                document[key] = data[key]
    for rule_id in unset:
        if rule_id not in items:
            raise RuleError(f"No {layer} override to unset: {rule_id}")
        del items[rule_id]
        touched.append(rule_id)
    if base_style:
        document["baseStyle"] = base_style
    document["rules"] = list(items.values())
    index_path = str(store.index_path(layer))
    proposed = {index_path: dump(document), **details}
    # Remove only formerly referenced detail files that this proposal makes obsolete.
    retained = {detail_path(root, item["detail"]) for item in document["rules"] if "detail" in item}
    for item in store.documents[layer]["rules"]:
        if item.get("detail") and detail_path(root, item["detail"]) not in retained:
            proposed[str(detail_path(root, item["detail"]))] = None
    future = Store(store.project, store.user_home, proposed)
    future.validate()
    if with_format:
        proposed[str((store.project / ".clang-format").resolve())] = export_format(future, executable)["content"]
    writes = []
    for path_text, after in sorted(proposed.items()):
        path = Path(path_text)
        before = path.read_text(encoding="utf-8") if path.is_file() else None
        if before == after:
            continue
        writes.append({
            "path": path_text, "beforeHash": file_hash(path), "before": before, "after": after,
            "diff": "".join(difflib.unified_diff(
                (before or "").splitlines(keepends=True), (after or "").splitlines(keepends=True),
                fromfile=path_text + " (before)", tofile=path_text + " (after)")),
        })
    impact = {
        "system": "All projects using this user's active system baseline",
        "user": "All projects without a project override",
        "project": "Current project only",
    }
    plan = {"schemaVersion": 1, "layer": layer, "project": str(store.project),
            "userHome": str(store.user_home), "snapshot": store.snapshot(),
            "touched": sorted(set(touched)), "writes": writes,
            "formatSnapshot": {"path": str((store.project / ".clang-format").resolve()),
                               "hash": file_hash(store.project / ".clang-format")} if with_format else None,
            "impact": impact[layer],
            "note": "Ask the user whether to persist and which layer; the digest is not proof of human consent"}
    plan["digest"] = digest(plan)
    return plan


def apply(store, proposal_path, confirmation):
    plan = json.loads(Path(proposal_path).read_text(encoding="utf-8"))
    original_digest = plan.get("digest")
    body = {key: value for key, value in plan.items() if key != "digest"}
    if not confirmation or original_digest != confirmation or digest(body) != confirmation:
        raise RuleError("Explicit confirmation of the unchanged proposal digest is required")
    if plan["project"] != str(store.project) or plan["userHome"] != str(store.user_home):
        raise RuleError("Proposal belongs to a different project or user")
    if plan["layer"] not in LAYERS:
        raise RuleError("Unknown proposal layer")
    if plan["snapshot"] != store.snapshot():
        raise RuleError("Stale proposal: rules or details changed; propose and confirm again")
    root = store.roots[plan["layer"]].resolve()
    allowed_index = store.index_path(plan["layer"])
    allowed_format = (store.project / ".clang-format").resolve()
    format_snapshot = plan.get("formatSnapshot")
    if format_snapshot is not None:
        if format_snapshot != {"path": str(allowed_format), "hash": file_hash(allowed_format)}:
            raise RuleError("Stale proposal: the requested format target changed")
    files = {}
    for write in plan["writes"]:
        path = Path(write["path"]).resolve()
        if path not in (allowed_index, allowed_format):
            if not path.is_relative_to(root):
                raise RuleError("Write outside selected rule layer")
            detail_path(root, path.relative_to(root).as_posix())
        if str(path) in files:
            raise RuleError("Duplicate proposal write")
        if file_hash(path) != write["beforeHash"]:
            raise RuleError(f"Stale proposal target: {path}")
        files[str(path)] = write["after"]
    future = Store(store.project, store.user_home, files)
    future.validate()
    done = []
    try:
        for write in plan["writes"]:
            path = Path(write["path"])
            if write["after"] is None:
                path.unlink(missing_ok=True)
            else:
                write_atomic(path, write["after"])
            done.append(write)
    except OSError:
        for write in reversed(done):
            path = Path(write["path"])
            if write["before"] is None:
                path.unlink(missing_ok=True)
            else:
                write_atomic(path, write["before"])
        raise
    current = Store(store.project, store.user_home)
    effective = []
    for key in plan["touched"]:
        if key in current.metadata():
            effective.append({"id": key, **current.get(key)})
        else:
            effective.append({"id": key, "layer": None, "rule": None})
    return {"written": [{"path": w["path"], "content": w["after"], "diff": w["diff"]}
                        for w in plan["writes"]],
            "layer": plan["layer"], "effective": effective, "digest": confirmation}
