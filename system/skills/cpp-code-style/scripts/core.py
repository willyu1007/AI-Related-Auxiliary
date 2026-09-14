"""Layered rule data: strict YAML, lazy details, provenance and validation."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re

import jsonschema
import yaml

SKILL = Path(__file__).resolve().parents[1]
DATA_PATH = Path(".agents/skill-data/cpp-code-style")
SCHEMA = json.loads((SKILL / "references/rules.schema.json").read_text(encoding="utf-8"))
LAYERS = ("system", "user", "organization", "project")
REQUIRED_LAYERS = ("system", "user", "project")
ORGANIZATION_ID = re.compile(r"^[a-z][a-z0-9-]*$")
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
        "organization": user_root / "organization",
        "project": project / DATA_PATH,
    }


def organization_ref_path(project):
    return (Path(project).resolve() / DATA_PATH / "organization.yaml").resolve()


def parse_organization_ref(text):
    data = parse(text)
    if not isinstance(data, dict) or set(data) != {"schemaVersion", "id", "revision"}:
        raise RuleError("Organization reference requires exactly schemaVersion, id, and revision")
    if data["schemaVersion"] != 1:
        raise RuleError("Organization reference schemaVersion must be 1")
    if not isinstance(data["id"], str) or not ORGANIZATION_ID.fullmatch(data["id"]):
        raise RuleError(f"Invalid organization id: {data['id']}")
    if not isinstance(data["revision"], str) or not data["revision"]:
        raise RuleError("Organization reference requires a nonempty revision")
    return {"id": data["id"], "revision": data["revision"]}


def read_organization_binding(project, files=None):
    path = organization_ref_path(project)
    key = str(path)
    if files and key in files:
        text = files[key]
        if text is None:
            return None, path
    elif path.is_file():
        text = path.read_text(encoding="utf-8")
    else:
        return None, path
    return parse_organization_ref(text), path


def organization_identity_mismatch(binding, data):
    identity = data.get("organization") if isinstance(data, dict) else None
    if not isinstance(identity, dict):
        return (
            f"Organization cache identity mismatch: reference {binding['id']}@{binding['revision']}, "
            "cache missing identity"
        )
    if identity.get("id") != binding["id"] or identity.get("revision") != binding["revision"]:
        return (
            f"Organization identity mismatch: reference revision {binding['revision']}, "
            f"cache revision {identity.get('revision')}"
        )
    return None


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
    if layer == "organization" and "organization" not in data:
        raise RuleError("Organization rules require organization identity")
    if layer == "organization" and "baseStyle" in data:
        raise RuleError("organization rules cannot declare baseStyle")
    if layer != "organization" and "organization" in data:
        raise RuleError(f"{layer} rules cannot declare organization identity")
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
        self.binding, self.binding_path = read_organization_binding(self.project, self.files)
        self.bound = self.binding is not None
        self.documents = {}
        self.present = {}
        for layer, root in self.roots.items():
            if layer == "organization" and not self.bound:
                self.present[layer] = False
                self.documents[layer] = {"schemaVersion": 1, "rules": []}
                continue
            path = self.index_path(layer)
            text = self.read_text(path)
            self.present[layer] = text is not None
            data = parse(text) if text is not None else {"schemaVersion": 1, "rules": []}
            if self.present[layer]:
                validate_index(data, layer)
                if layer == "organization":
                    mismatch = organization_identity_mismatch(self.binding, data)
                    if mismatch:
                        raise RuleError(mismatch)
            for item in data["rules"]:
                if "detail" in item:
                    detail_path(root, item["detail"])
            self.documents[layer] = data

    def required_layers(self):
        return LAYERS if self.bound else REQUIRED_LAYERS

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
        for layer in self.required_layers():
            for rule_id in self.metadata(layer):
                self.get(rule_id, layer)
        if not all(self.present[layer] for layer in self.required_layers()):
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
        if not all(self.present[layer] for layer in self.required_layers()):
            raise RuleError("C++ rules are not initialized")
        self.validate()

    def snapshot(self):
        layers = self.required_layers()
        paths = {self.index_path(layer) for layer in layers}
        paths.add(SKILL / "references/rules.schema.json")
        if self.bound or str(self.binding_path) in self.files or self.binding_path.is_file():
            paths.add(self.binding_path)
        for layer in layers:
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


def _layer_status(root, layer):
    path = (root / "rules.yaml").resolve()
    row = {"path": str(path)}
    if not path.is_file():
        row["state"] = "missing"
        return row
    data = parse(path.read_text(encoding="utf-8"))
    validate_index(data, layer)
    _validate_layer_details(root, data)
    row["state"] = "empty" if not data["rules"] else "valid"
    row["ruleCount"] = len(data["rules"])
    row["data"] = data
    return row


def status(project, user_home):
    roots = layer_roots(project, user_home)
    result = {"ready": False, "layers": {}}
    ref_path = organization_ref_path(project)
    binding = None
    binding_error = None
    try:
        binding, ref_path = read_organization_binding(project)
    except (OSError, UnicodeError, RuleError, yaml.YAMLError, TypeError, ValueError) as exc:
        binding_error = str(exc)
    for layer in LAYERS:
        if layer == "organization":
            row = {
                "path": str((roots[layer] / "rules.yaml").resolve()),
                "referencePath": str(ref_path),
            }
            try:
                if binding_error:
                    row["state"] = "invalid"
                    row["error"] = binding_error
                elif binding is None:
                    row["state"] = "unbound"
                else:
                    inspected = _layer_status(roots[layer], layer)
                    data = inspected.pop("data", None)
                    row.update(inspected)
                    if row["state"] in {"empty", "valid"}:
                        mismatch = organization_identity_mismatch(binding, data)
                        if mismatch:
                            row["state"] = "invalid"
                            row["error"] = mismatch
                        else:
                            row["id"] = data["organization"]["id"]
                            row["revision"] = data["organization"]["revision"]
            except (OSError, UnicodeError, RuleError, yaml.YAMLError, TypeError, ValueError) as exc:
                row["state"] = "invalid"
                row["error"] = str(exc)
            result["layers"][layer] = row
            continue
        row = {"path": str((roots[layer] / "rules.yaml").resolve())}
        try:
            inspected = _layer_status(roots[layer], layer)
            inspected.pop("data", None)
            row.update(inspected)
        except (OSError, UnicodeError, RuleError, yaml.YAMLError, TypeError, ValueError) as exc:
            row["state"] = "invalid"
            row["error"] = str(exc)
        result["layers"][layer] = row
    required_ready = all(
        result["layers"][name]["state"] in {"empty", "valid"} for name in REQUIRED_LAYERS
    )
    result["ready"] = required_ready and result["layers"]["organization"]["state"] in {
        "unbound", "empty", "valid",
    }
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
