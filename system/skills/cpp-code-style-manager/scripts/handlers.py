"""Management-side formatter inspection and export helpers."""
import json
import shutil
import subprocess

from core import RuleError, dump

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
