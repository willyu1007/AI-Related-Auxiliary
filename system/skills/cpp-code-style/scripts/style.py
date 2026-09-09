#!/usr/bin/env python3
"""Query and maintain C++ rules. Mutations require a reviewed proposal."""
import argparse
import json
from pathlib import Path
import sys
import subprocess
import yaml

from core import RuleError, Store, list_rules, parse, status
from handlers import check_files, export_format, formatter_info
from proposals import apply, propose
from profiles import catalog_upgrade


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=Path.cwd(), help="Project root; not inferred from file parents")
    parser.add_argument("--user-home", type=Path, default=Path.home(), help="User home (override for isolated testing)")
    parser.add_argument("--clang-format", default="clang-format")
    commands = parser.add_subparsers(dest="command", required=True)
    listing = commands.add_parser("list", help="Read metadata only")
    listing.add_argument("--layer", choices=["effective", "system", "user", "project"], default="effective")
    getting = commands.add_parser("get", help="Read one full rule")
    getting.add_argument("id")
    getting.add_argument("--layer", choices=["effective", "system", "user", "project"], default="effective")
    explaining = commands.add_parser("explain", help="Read rule provenance and capability readiness")
    explaining.add_argument("id")
    commands.add_parser("validate", help="Validate every layer, detail, and scoped override")
    status_command = commands.add_parser("status", help="Report initialization state without writing")
    status_command.add_argument("--catalog", type=Path)
    commands.add_parser("export", help="Return effective .clang-format text without writing it")
    proposing = commands.add_parser("propose", help="Upsert rules or remove overrides; no rule writes")
    proposing.add_argument("--layer", choices=["system", "user", "project"], required=True)
    proposing.add_argument("--input", type=Path, help="Incoming rules.yaml with details relative to it")
    proposing.add_argument("--unset", action="append", default=[])
    proposing.add_argument("--base-style")
    proposing.add_argument("--with-format", action="store_true", help="Include project .clang-format diff")
    proposing.add_argument("--out", type=Path, help="Optional proposal JSON file")
    applying = commands.add_parser("apply", help="Apply only after user confirms content and layer")
    applying.add_argument("--proposal", type=Path, required=True)
    applying.add_argument("--confirm", required=True, help="Digest of the user-reviewed proposal")
    checking = commands.add_parser("check", help="Check explicit project files")
    checking.add_argument("files", nargs="+")
    checking.add_argument("--rule", action="append")
    checking.add_argument("--fix", action="store_true", help="Apply supported automatic fixes only")
    args = parser.parse_args()
    code = 0
    if args.command == "status":
        result = status(args.project, args.user_home)
        if args.catalog is None:
            result.update({"upgradeAvailable": None, "upgrade": None})
        else:
            active = None
            if result["layers"]["system"]["state"] in {"empty", "valid"}:
                active_path = Path(result["layers"]["system"]["path"])
                active = parse(active_path.read_text(encoding="utf-8"))
            result.update(catalog_upgrade(active, args.catalog))
    else:
        store = Store(args.project, args.user_home)
    if args.command == "status":
        pass
    elif args.command == "list":
        result = list_rules(store, args.layer)
    elif args.command == "get":
        result = store.get(args.id, args.layer)
    elif args.command == "explain":
        effective = store.get(args.id)
        chain = [store.get(args.id, layer) for layer in ("system", "user", "project")
                 if args.id in store.metadata(layer)]
        handler = effective["rule"]["config"].get("handler")
        readiness = "semantic"
        if handler == "clang-format":
            try:
                readiness = formatter_info(args.clang_format, store)[1]
            except RuleError as exc:
                readiness = str(exc)
        elif handler == "utf8-no-bom":
            readiness = "ready"
        elif handler:
            readiness = "not-implemented"
        result = {"effective": effective, "chain": chain, "readiness": readiness}
    elif args.command == "validate":
        result = store.validate()
    elif args.command == "export":
        store.require_ready()
        result = export_format(store, args.clang_format)
    elif args.command == "propose":
        if not (args.input or args.unset or args.base_style or args.with_format):
            raise RuleError("Provide --input, --unset, --base-style, or --with-format")
        result = propose(store, args.layer, args.input, args.unset, args.base_style,
                         args.with_format, args.clang_format)
        if args.out:
            output = args.out.resolve()
            if output.suffix != ".json" or any(output.is_relative_to(root.resolve()) for root in store.roots.values()):
                raise RuleError("Proposal output must be a .json file outside all rule layers")
            args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    elif args.command == "apply":
        result = apply(store, args.proposal, args.confirm)
    else:
        store.require_ready()
        result = check_files(store, args.files, args.clang_format, args.fix, args.rule)
        code = 0 if result["complete"] else 1
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
