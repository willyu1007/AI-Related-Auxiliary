"""Layered rule data: strict YAML, lazy details, provenance and validation."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import jsonschema
import yaml

SKILL = Path(__file__).resolve().parents[1]
DATA_PATH = Path(".agents/skill-data/cpp-code-style")
SCHEMA = json.loads((SKILL / "references/rules.schema.json").read_text(encoding="utf-8"))
LAYERS = ("system", "user", "project")
MODES = {"automated", "semantic", "hybrid", "unavailable"}
REGISTRY = {
    "clang-format": {"check": "automated", "fix": "automated"},
    "utf8-no-bom": {"check": "automated", "fix": "unavailable"},
}


class RuleError(ValueError):
    """A user-visible rule or proposal error."""


class UniqueLoader(yaml.SafeLoader):
    """Reject duplicate keys rather than silently discarding rules."""


def unique_mapping(loader, node, deep=False):
    pairs = loader.construct_pairs(node, deep=deep)
    result = {}
    for key, value in pairs:
        if not isinstance(key, str):
            raise RuleError("YAML mapping keys must be strings")
        if key in result:
            raise RuleError(f"Duplicate YAML key: {key}")
        result[key] = value
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


def parse(text):
    return yaml.load(text, Loader=UniqueLoader)


def dump(data):
    return yaml.safe_dump(data, allow_unicode=True, sort_keys=False)


def digest(data):
    return hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode("utf-8")).hexdigest()


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def detail_path(root, relative):
    path = (root / relative).resolve()
    details = (root / "details").resolve()
    if not path.is_relative_to(details) or not details.is_relative_to(root.resolve()):
        raise RuleError(f"Detail escapes its layer: {relative}")
    if path.suffix != ".yaml":
        raise RuleError("Detail must be a YAML file")
    return path


def layer_roots(project, user_home):
    project = Path(project).resolve()
    user_root = Path(user_home).resolve() / DATA_PATH
    return {
        "system": user_root / "system",
        "user": user_root,
        "project": project / DATA_PATH,
    }


def validate_index(data, layer):
    try:
        jsonschema.Draft202012Validator(
            SCHEMA, format_checker=jsonschema.FormatChecker()
        ).validate(data)
    except jsonschema.ValidationError as exc:
        raise RuleError(f"Invalid rules at {list(exc.absolute_path)}: {exc.message}") from exc
    if layer == "system" and "profile" not in data:
        raise RuleError("System rules require profile metadata")
    if layer == "system" and "baseStyle" not in data:
        raise RuleError("System rules require baseStyle")
    if layer != "system" and "profile" in data:
        raise RuleError(f"{layer} rules cannot declare a system profile")
    ids = [item["id"] for item in data["rules"]]
    if len(ids) != len(set(ids)):
        raise RuleError("Duplicate rule IDs in the same layer")
    details = [item["detail"] for item in data["rules"] if "detail" in item]
    if len(details) != len(set(details)):
        raise RuleError("Each detail file must belong to one rule")


def validate_config(item):
    config = item["config"]
    try:
        jsonschema.Draft202012Validator(SCHEMA["$defs"]["config"]).validate(config)
    except jsonschema.ValidationError as exc:
        raise RuleError(f'{item["id"]}: {exc.message}') from exc
    handler = config.get("handler")
    if handler == "clang-format":
        options = config.get("options")
        if not isinstance(options, dict) or not options:
            raise RuleError("clang-format rules require nonempty options")
        if set(options) & {"BasedOnStyle", "Language", "DisableFormat"}:
            raise RuleError("Use baseStyle; Language/DisableFormat cannot be overridden")
    elif "options" in config:
        raise RuleError("options belong to the clang-format handler")
    capabilities = REGISTRY.get(handler)
    if capabilities:
        for operation, mode in item["execution"].items():
            if mode == "automated" and capabilities[operation] != "automated":
                raise RuleError(f"{handler} does not automate {operation}")
    if handler is None and any(mode in {"automated", "hybrid"} for mode in item["execution"].values()):
        raise RuleError(f'{item["id"]}: automated parts require a named handler')


class Store:
    """Read only the requested depth; file overrides validate proposed state in memory."""

    def __init__(self, project, user_home, files=None):
        self.project = Path(project).resolve()
        self.user_home = Path(user_home).resolve()
        self.roots = layer_roots(self.project, self.user_home)
        self.files = files or {}
        self.documents = {}
        self.present = {}
        for layer, root in self.roots.items():
            path = self.index_path(layer)
            text = self.read_text(path)
            self.present[layer] = text is not None
            data = parse(text) if text is not None else {"schemaVersion": 1, "rules": []}
            if self.present[layer]:
                validate_index(data, layer)
            for item in data["rules"]:
                if "detail" in item:
                    detail_path(root, item["detail"])
            self.documents[layer] = data

    def index_path(self, layer):
        return (self.roots[layer] / "rules.yaml").resolve()

    def read_text(self, path):
        key = str(path.resolve())
        if key in self.files:
            return self.files[key]
        return path.read_text(encoding="utf-8") if path.is_file() else None

    def metadata(self, layer="effective"):
        result = {}
        selected = LAYERS if layer == "effective" else (layer,)
        for name in selected:
            for item in self.documents[name]["rules"]:
                result[item["id"]] = {**deepcopy(item), "layer": name}
        return result

    def get(self, rule_id, layer="effective"):
        item = self.metadata(layer).get(rule_id)
        if item is None:
            raise RuleError(f"Unknown rule: {rule_id}")
        origin = item.pop("layer")
        if "detail" in item:
            path = detail_path(self.roots[origin], item["detail"])
            text = self.read_text(path)
            if text is None:
                raise RuleError(f"Missing detail: {path}")
            detail = parse(text)
            if not isinstance(detail, dict) or set(detail) != {"id", "config"}:
                raise RuleError(f"Detail requires exactly id and config: {path}")
            if detail["id"] != rule_id:
                raise RuleError(f"Detail ID mismatch: {path}")
            item["config"] = detail["config"]
        validate_config(item)
        return {"layer": origin, "path": str(self.index_path(origin)), "rule": item}

    def settings(self):
        merged = {}
        source = {}
        for layer in LAYERS:
            document = self.documents[layer]
            for key in ("baseStyle", "toolchain"):
                if key in document:
                    if key == "toolchain":
                        merged.setdefault(key, {}).update(document[key])
                    else:
                        merged[key] = document[key]
                    source[key] = layer
        return merged, source

    def validate(self):
        for layer in LAYERS:
            for rule_id in self.metadata(layer):
                self.get(rule_id, layer)
        if not all(self.present.values()):
            return {"valid": True, "ruleCount": len(self.metadata())}
        effective = self.metadata()
        active = {key: item for key, item in effective.items() if item["enabled"]}
        for key, item in active.items():
            for parent in item.get("overrides", []):
                if parent not in effective:
                    raise RuleError(f"{key}: unknown overridden rule {parent}")
        visited, visiting = set(), set()

        def visit(key):
            if key in visiting:
                raise RuleError("Cyclic scoped overrides")
            if key in visited or key not in active:
                return
            visiting.add(key)
            for parent in active[key].get("overrides", []):
                visit(parent)
            visiting.remove(key)
            visited.add(key)

        for key in active:
            visit(key)
        self.format_options()
        return {"valid": True, "ruleCount": len(effective)}

    def format_options(self):
        settings, sources = self.settings()
        if "baseStyle" not in settings:
            raise RuleError("No active baseStyle is configured")
        options = {"BasedOnStyle": settings["baseStyle"], "Language": "Cpp"}
        owners = {}
        rule_ids = []

        def merge(target, incoming, prefix, owner):
            for key, value in incoming.items():
                field = f"{prefix}.{key}" if prefix else key
                if isinstance(value, dict):
                    if key in target and not isinstance(target[key], dict):
                        raise RuleError(f"Conflicting format field: {field}")
                    merge(target.setdefault(key, {}), value, field, owner)
                else:
                    if field in owners:
                        raise RuleError(f"Duplicate format setting {field}: {owners[field]}, {owner}")
                    if key in target and isinstance(target[key], dict):
                        raise RuleError(f"Conflicting format field: {field}")
                    target[key] = value
                    owners[field] = owner

        for key, meta in self.metadata().items():
            if not meta["enabled"]:
                continue
            item = self.get(key)["rule"]
            if item["config"].get("handler") == "clang-format":
                merge(options, item["config"]["options"], "", key)
                rule_ids.append(key)
        return options, owners, rule_ids

    def require_ready(self):
        if not all(self.present.values()):
            raise RuleError("C++ rules are not initialized")
        self.validate()

    def snapshot(self):
        paths = {self.index_path(layer) for layer in LAYERS}
        paths.add(SKILL / "references/rules.schema.json")
        for layer in LAYERS:
            for item in self.documents[layer]["rules"]:
                if "detail" in item:
                    paths.add(detail_path(self.roots[layer], item["detail"]))
        return {str(path.resolve()): file_hash(path) for path in sorted(paths)}


def _validate_layer_details(root, data):
    for item in data["rules"]:
        full = deepcopy(item)
        if "detail" in item:
            path = detail_path(root, item["detail"])
            text = path.read_text(encoding="utf-8")
            detail = parse(text)
            if not isinstance(detail, dict) or set(detail) != {"id", "config"}:
                raise RuleError(f"Detail requires exactly id and config: {path}")
            if detail["id"] != item["id"]:
                raise RuleError(f"Detail ID mismatch: {path}")
            full["config"] = detail["config"]
        validate_config(full)


def status(project, user_home):
    roots = layer_roots(project, user_home)
    result = {"ready": False, "layers": {}}
    for layer in LAYERS:
        path = (roots[layer] / "rules.yaml").resolve()
        row = {"path": str(path)}
        try:
            if not path.is_file():
                row["state"] = "missing"
            else:
                data = parse(path.read_text(encoding="utf-8"))
                validate_index(data, layer)
                _validate_layer_details(roots[layer], data)
                row["state"] = "empty" if not data["rules"] else "valid"
                row["ruleCount"] = len(data["rules"])
        except (OSError, UnicodeError, RuleError, yaml.YAMLError, TypeError, ValueError) as exc:
            row["state"] = "invalid"
            row["error"] = str(exc)
        result["layers"][layer] = row
    result["ready"] = all(
        row["state"] in {"empty", "valid"} for row in result["layers"].values()
    )
    return result

def list_rules(store, layer):
    rows = []
    for item in store.metadata(layer).values():
        row = {key: value for key, value in item.items() if key != "config"}
        # Do not inspect detail files to infer capabilities during listing.
        row["readiness"] = "not-probed"
        rows.append(row)
    settings, sources = store.settings()
    return {"settings": settings, "settingSources": sources, "rules": rows}
