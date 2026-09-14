"""Reviewable mutations with explicit scope, digest confirmation and stale checks."""
from copy import deepcopy
import difflib
import json
from pathlib import Path
import os
import sys
import tempfile

from core import (LAYERS, RuleError, Store, detail_path, digest, dump, file_hash,
                  organization_ref_path, parse, validate_index, validate_config)
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
        if layer == "organization":
            document["organization"] = deepcopy(data["organization"])
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
    if layer == "organization":
        if "organization" not in document:
            raise RuleError("Organization rules require organization identity")
        identity = document["organization"]
        proposed[str(organization_ref_path(store.project))] = dump({
            "schemaVersion": 1,
            "id": identity["id"],
            "revision": identity["revision"],
        })
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
        "organization": "Projects that bind this organization identity",
        "project": "Current project only",
    }
    plan = {"schemaVersion": 1, "layer": layer, "project": str(store.project),
            "userHome": str(store.user_home), "snapshot": store.snapshot(),
            "touched": sorted(set(touched)), "writes": writes,
            "formatSnapshot": {"path": str((store.project / ".clang-format").resolve()),
                               "hash": file_hash(store.project / ".clang-format")} if with_format else None,
            "impact": impact[layer]}
    plan["digest"] = digest(plan)
    return plan


def _log(verbose, message):
    if verbose:
        print(f"[cpp-code-style] {message}", file=sys.stderr)


def _digest_text(value):
    return "null" if value is None else str(value)


def _snapshot_changes(expected, actual):
    changes = []
    for path in sorted(set(expected) | set(actual)):
        if expected.get(path) == actual.get(path):
            continue
        name = Path(path).name
        if name == "rules.schema.json":
            kind = "schema"
        elif name == "rules.yaml":
            kind = "rules"
        elif Path(path).parent.name == "details":
            kind = "detail"
        else:
            kind = "tracked file"
        changes.append(
            f"{kind} changed at {path} "
            f"(expectedHash={expected.get(path)}, actualHash={actual.get(path)})"
        )
    return changes


def apply(store, proposal_path, confirmation=None, verbose=False):
    proposal_path = Path(proposal_path).resolve()
    _log(verbose, f"load proposal: {proposal_path}")
    plan = json.loads(proposal_path.read_text(encoding="utf-8"))
    original_digest = plan.get("digest")
    body = {key: value for key, value in plan.items() if key != "digest"}
    actual_digest = digest(body)
    if not confirmation:
        raise RuleError(
            "Confirmation digest is required; "
            f"providedDigest={_digest_text(confirmation)}, "
            f"proposalDigest={_digest_text(original_digest)}"
        )
    if original_digest != confirmation and actual_digest == original_digest:
        raise RuleError(
            "Proposal digest mismatch; "
            f"providedDigest={_digest_text(confirmation)}, "
            f"proposalDigest={_digest_text(original_digest)}"
        )
    if actual_digest != original_digest:
        raise RuleError(
            "Proposal file was modified; "
            f"proposalDigest={_digest_text(original_digest)}, "
            f"actualDigest={_digest_text(actual_digest)}"
        )
    _log(verbose, "proposal digest validated")
    if plan["project"] != str(store.project) or plan["userHome"] != str(store.user_home):
        raise RuleError("Proposal belongs to a different project or user")
    if plan["layer"] not in LAYERS:
        raise RuleError("Unknown proposal layer")
    current_snapshot = store.snapshot()
    if plan["snapshot"] != current_snapshot:
        changes = _snapshot_changes(plan["snapshot"], current_snapshot)
        raise RuleError("Stale proposal: " + "; ".join(changes) + "; propose and confirm again")
    root = store.roots[plan["layer"]].resolve()
    allowed_index = store.index_path(plan["layer"])
    allowed_format = (store.project / ".clang-format").resolve()
    allowed_ref = organization_ref_path(store.project)
    format_snapshot = plan.get("formatSnapshot")
    if format_snapshot is not None:
        actual_format_snapshot = {"path": str(allowed_format), "hash": file_hash(allowed_format)}
        if format_snapshot != actual_format_snapshot:
            raise RuleError(
                "Stale proposal: the requested format target changed; "
                f"expected={format_snapshot}, actual={actual_format_snapshot}"
            )
    _log(verbose, "preflight proposal targets")
    files = {}
    for write in plan["writes"]:
        path = Path(write["path"]).resolve()
        if path not in (allowed_index, allowed_format, allowed_ref):
            if not path.is_relative_to(root):
                raise RuleError("Write outside selected rule layer")
            detail_path(root, path.relative_to(root).as_posix())
        if str(path) in files:
            raise RuleError("Duplicate proposal write")
        actual_hash = file_hash(path)
        if actual_hash != write["beforeHash"]:
            raise RuleError(
                f"Stale proposal target: {path} changed; "
                f"expectedHash={write['beforeHash']}, actualHash={actual_hash}"
            )
        files[str(path)] = write["after"]
    future = Store(store.project, store.user_home, files)
    future.validate()
    _log(verbose, f"preflight complete: {len(files)} target(s)")
    done = []
    current_write = None
    try:
        for write in plan["writes"]:
            current_write = write
            path = Path(write["path"])
            operation = "delete" if write["after"] is None else "replace"
            _log(verbose, f"write start ({operation}): {path}")
            if write["after"] is None:
                path.unlink(missing_ok=True)
            else:
                write_atomic(path, write["after"])
            done.append(write)
            _log(verbose, f"write complete ({operation}): {path}")
    except OSError as exc:
        failed_path = current_write["path"] if current_write is not None else "<unknown>"
        operation = "delete" if current_write is not None and current_write["after"] is None else "replace"
        _log(verbose, f"write failed ({operation}): {failed_path}: {type(exc).__name__}: {exc}")
        for write in reversed(done):
            path = Path(write["path"])
            if write["before"] is None:
                path.unlink(missing_ok=True)
            else:
                write_atomic(path, write["before"])
        raise RuleError(
            f"Write failed ({operation}) at {failed_path}: {type(exc).__name__}: {exc}"
        ) from exc
    current = Store(store.project, store.user_home)
    effective = []
    for key in plan["touched"]:
        if key in current.metadata():
            effective.append({"id": key, **current.get(key)})
        else:
            effective.append({"id": key, "layer": None, "rule": None})
    _log(verbose, f"apply complete: {len(plan['writes'])} target(s)")
    return {"written": [{"path": w["path"], "content": w["after"], "diff": w["diff"]}
                        for w in plan["writes"]],
            "layer": plan["layer"], "effective": effective, "digest": confirmation}
