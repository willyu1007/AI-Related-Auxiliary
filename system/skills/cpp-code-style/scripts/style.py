#!/usr/bin/env python3
"""Read effective C++ rules and check explicitly selected files."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import yaml

from core import RuleError, Store, list_rules
from handlers import check_files


MIN_PYTHON = (3, 9)


def require_supported_python():
    if sys.version_info < MIN_PYTHON:
        raise RuleError(
            f"Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]} or newer is required; "
            f"running {sys.version_info.major}.{sys.version_info.minor}"
        )


def main():
    require_supported_python()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=Path.cwd(), help="Project root; not inferred from file parents")
    parser.add_argument("--user-home", type=Path, default=Path.home(), help="User home (override for isolated testing)")
    parser.add_argument("--clang-format", default="clang-format")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="Read enabled effective rule metadata")
    getting = commands.add_parser("get", help="Read one effective rule")
    getting.add_argument("id")
    checking = commands.add_parser("check", help="Check explicit project files")
    checking.add_argument("files", nargs="+")
    checking.add_argument("--rule", action="append")
    checking.add_argument("--fix", action="store_true", help="Apply supported automatic fixes only")
    args = parser.parse_args()
    store = Store(args.project, args.user_home)
    if args.command == "list":
        result = list_rules(store, "effective")
    elif args.command == "get":
        result = store.get(args.id)
    else:
        store.require_ready()
        result = check_files(store, args.files, args.clang_format, args.fix, args.rule)
        code = 0 if result["complete"] else 1
    if args.command != "check":
        code = 0
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return code


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    try:
        raise SystemExit(main())
    except (RuleError, OSError, ValueError, KeyError, TypeError, yaml.YAMLError, subprocess.TimeoutExpired) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2)
