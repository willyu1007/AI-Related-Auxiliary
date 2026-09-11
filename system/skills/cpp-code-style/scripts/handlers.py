"""Built-in deterministic checks; semantic work is always reported separately."""
from pathlib import Path
import json
import shutil
import subprocess

from core import RuleError, dump

CPP_SUFFIXES = {".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx", ".c"}


def formatter_info(executable, store):
    resolved = shutil.which(executable)
    if resolved is None:
        raise RuleError(f"clang-format not available: {executable}")
    result = subprocess.run([resolved, "--version"], capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuleError(result.stderr)
    version = result.stdout.strip()
    expected = store.settings()[0].get("toolchain", {}).get("clangFormatVersion")
    if expected and expected not in version.split():
        raise RuleError(f"clang-format version mismatch: expected {expected}; got {version}")
    return resolved, version


def export_format(store, executable):
    options, owners, ids = store.format_options()
    resolved, version = formatter_info(executable, store)
    # Ask the installed formatter to validate options and expand external defaults.
    result = subprocess.run(
        [resolved, "--style=" + json.dumps(options), "--dump-config"],
        capture_output=True, encoding="utf-8", timeout=30,
    )
    if result.returncode:
        raise RuleError(result.stderr.strip())
    return {"content": dump(options), "options": options, "resolvedContent": result.stdout,
            "toolVersion": version, "optionSources": owners, "ruleIds": ids}


def select_rules(store, only):
    metadata = store.metadata()
    if not only:
        return metadata
    selected_ids = set()
    unknown = []
    for rule_id in only:
        if rule_id == "format":
            selected_ids.update(
                key for key in metadata
                if store.get(key)["rule"].get("config", {}).get("handler") == "clang-format"
            )
        elif rule_id in metadata:
            selected_ids.add(rule_id)
        else:
            unknown.append(rule_id)
    if unknown:
        raise RuleError(f"Unknown rules: {sorted(unknown)}")
    return {key: item for key, item in metadata.items() if key in selected_ids}


def check_files(store, paths, executable, fix=False, only=None):
    store.validate()
    selected = select_rules(store, only)
    active = [store.get(key)["rule"] for key, meta in selected.items() if meta["enabled"]]
    all_format_rules = [store.get(key)["rule"] for key, meta in store.metadata().items()
                        if meta["enabled"] and store.get(key)["rule"]["config"].get("handler") == "clang-format"]
    format_rules = [r for r in active if r["config"].get("handler") == "clang-format"
                    and r["execution"]["check"] in {"automated", "hybrid"}]
    # A partial formatting run still uses the complete effective format configuration.
    others = [r for r in active if r not in format_rules]
    run_format = bool(format_rules) or (not only and not all_format_rules)
    results = []
    format_config = None
    format_error = None
    if run_format:
        try:
            format_config = export_format(store, executable)
        except RuleError as exc:
            format_error = str(exc)
    for value in paths:
        path = Path(value).resolve()
        if not path.is_relative_to(store.project) or not path.is_file():
            raise RuleError(f"Expected an existing file inside project: {path}")
        if path.suffix.lower() not in CPP_SUFFIXES:
            raise RuleError(f"Not a supported C/C++ source path: {path}")
        content = path.read_bytes()
        if run_format:
            row = {"id": "format", "ruleIds": [r["id"] for r in format_rules],
                   "file": str(path), "kind": "automated"}
            if format_error:
                row.update(status="not-executed", message=format_error)
            else:
                result = subprocess.run(
                    [executable, "--style=" + json.dumps(format_config["options"]), "--assume-filename=" + str(path)],
                    input=content, capture_output=True, timeout=30,
                )
                if result.returncode:
                    row.update(status="error", message=result.stderr.decode("utf-8", errors="replace"))
                else:
                    changed = result.stdout != content
                    can_fix = all(r["execution"]["fix"] == "automated" for r in all_format_rules)
                    if fix and changed and can_fix:
                        path.write_bytes(result.stdout)
                        content = result.stdout
                    row.update(status="pass" if not changed or (fix and can_fix) else "violation",
                               fixed=bool(fix and changed and can_fix))
            if row["status"] == "pass" and any(r["execution"]["check"] == "hybrid" for r in format_rules):
                row["status"] = "needs-review"
            results.append(row)
        for item in others:
            mode = item["execution"]["check"]
            row = {"id": item["id"], "file": str(path), "severity": item["severity"],
                   "kind": "semantic" if mode == "semantic" else mode}
            handler = item["config"].get("handler")
            if mode == "semantic":
                row.update(status="needs-review", message="Load this rule's detail and review applicable code")
            elif mode == "unavailable":
                row.update(status="not-executed", message="No check implementation")
            elif handler == "utf8-no-bom":
                try:
                    content.decode("utf-8")
                    valid = not content.startswith(b"\xef\xbb\xbf")
                except UnicodeDecodeError:
                    valid = False
                row.update(status="violation" if not valid else
                           ("needs-review" if mode == "hybrid" else "pass"))
            else:
                row.update(status="not-executed", message=f"Handler not implemented: {handler}")
            # No semantic rewrite is performed by --fix.
            results.append(row)
    automated = [row for row in results if row["kind"] in {"automated", "hybrid"}]
    semantic = [row for row in results if row["kind"] in {"semantic", "hybrid"}]
    automated_failures = sum(row["status"] in {"violation", "error"} for row in automated)
    automated_not_executed = sum(row["status"] == "not-executed" for row in automated)
    semantic_pending = sum(row["status"] == "needs-review" for row in semantic)
    return {
        "results": results,
        "automated": {
            "passed": automated_failures == 0 and automated_not_executed == 0,
            "failed": automated_failures,
            "notExecuted": automated_not_executed,
        },
        "semantic": {
            "needsReview": semantic_pending > 0,
            "pending": semantic_pending,
            "ruleCount": len(semantic),
        },
        "complete": all(r["status"] == "pass" for r in results),
    }
