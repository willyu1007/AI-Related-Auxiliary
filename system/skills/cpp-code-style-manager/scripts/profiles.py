"""Validate bundled profile catalogs and compare an active system snapshot."""
import re
from pathlib import Path

from core import RuleError, parse, validate_index


PROFILE_ID = re.compile(r"^[a-z][a-z0-9-]*$")
CATALOG_KEYS = {"schemaVersion", "defaultProfile", "profiles"}
PROFILE_KEYS = {"id", "name", "revision", "path", "summary", "coverage"}
COVERAGE_KEYS = {"included", "omitted"}


def _strings(value, field, allow_empty):
    if not isinstance(value, list) or (not allow_empty and not value):
        raise RuleError(f"Catalog {field} must be a nonempty string list")
    if not all(isinstance(item, str) and item for item in value):
        raise RuleError(f"Catalog {field} must contain nonempty strings")


def load_catalog(index_path):
    index_path = Path(index_path).resolve()
    if not index_path.is_file():
        raise RuleError(f"Catalog not found: {index_path}")
    data = parse(index_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or set(data) != CATALOG_KEYS:
        raise RuleError("Catalog requires exactly schemaVersion, defaultProfile, and profiles")
    if data["schemaVersion"] != 1:
        raise RuleError("Catalog schemaVersion must be 1")
    if not isinstance(data["defaultProfile"], str):
        raise RuleError("Catalog defaultProfile must be a string")
    if not isinstance(data["profiles"], list) or not data["profiles"]:
        raise RuleError("Catalog profiles must be a nonempty list")

    root = index_path.parent.resolve()
    seen = set()
    profiles = []
    for entry in data["profiles"]:
        if not isinstance(entry, dict) or set(entry) != PROFILE_KEYS:
            raise RuleError("Catalog profile has unexpected keys")
        profile_id = entry["id"]
        if not isinstance(profile_id, str) or not PROFILE_ID.fullmatch(profile_id):
            raise RuleError(f"Invalid catalog profile ID: {profile_id}")
        if profile_id in seen:
            raise RuleError(f"Duplicate catalog profile ID: {profile_id}")
        seen.add(profile_id)
        for field in ("name", "revision", "path", "summary"):
            if not isinstance(entry[field], str) or not entry[field]:
                raise RuleError(f"Catalog profile {profile_id} requires nonempty {field}")
        coverage = entry["coverage"]
        if not isinstance(coverage, dict) or set(coverage) != COVERAGE_KEYS:
            raise RuleError(f"Catalog profile {profile_id} has invalid coverage")
        _strings(coverage["included"], f"{profile_id}.coverage.included", False)
        _strings(coverage["omitted"], f"{profile_id}.coverage.omitted", True)

        relative = Path(entry["path"])
        if relative.is_absolute() or relative.suffix.lower() != ".yaml":
            raise RuleError(f"Catalog package path must be a relative YAML path: {entry['path']}")
        package = (root / relative).resolve()
        if not package.is_relative_to(root) or not package.is_file():
            raise RuleError(f"Catalog package escapes or is missing: {entry['path']}")
        package_data = parse(package.read_text(encoding="utf-8"))
        validate_index(package_data, "system")
        package_profile = package_data["profile"]
        for field in ("id", "name", "revision"):
            if package_profile[field] != entry[field]:
                raise RuleError(f"Catalog package profile mismatch for {profile_id}: {field}")
        profiles.append({**entry, "package": str(package)})

    if data["defaultProfile"] not in seen:
        raise RuleError("Catalog defaultProfile does not name a profile")
    return {**data, "profiles": profiles}


def catalog_upgrade(active_system, index_path):
    catalog = load_catalog(index_path)
    if not active_system or not isinstance(active_system, dict):
        return {"upgradeAvailable": False, "upgrade": None}
    active_profile = active_system.get("profile")
    if not isinstance(active_profile, dict) or active_profile.get("origin") != "bundled":
        return {"upgradeAvailable": False, "upgrade": None}
    candidate = next(
        (item for item in catalog["profiles"] if item["id"] == active_profile.get("id")),
        None,
    )
    if candidate is None or active_profile.get("revision") == candidate["revision"]:
        return {"upgradeAvailable": False, "upgrade": None}
    return {
        "upgradeAvailable": True,
        "upgrade": {
            "profileId": candidate["id"],
            "currentRevision": active_profile.get("revision"),
            "candidateRevision": candidate["revision"],
            "package": candidate["package"],
        },
    }


