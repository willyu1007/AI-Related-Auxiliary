"""Exercise the CLI through isolated user and project directories."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

CLI = Path(__file__).resolve().parents[1] / "scripts" / "style.py"
sys.path.insert(0, str(CLI.parent))
from core import digest

MANAGER = CLI.parents[2] / "cpp-code-style-manager"
CATALOG = MANAGER / "assets" / "system-profiles" / "index.yaml"
GOOGLE = MANAGER / "assets" / "system-profiles" / "google" / "rules.yaml"
JSMODEL = MANAGER / "assets" / "organization-profiles" / "jsmodel" / "rules.yaml"


def rule(rule_id="format.indentation", options=None):
    return {
        "id": rule_id, "summary": "Indentation", "appliesTo": "C++ files",
        "enabled": True, "severity": "required",
        "execution": {"check": "automated", "fix": "automated"},
        "config": {"handler": "clang-format", "options": options or {"IndentWidth": 4}},
    }


def profile(profile_id="google", revision="2026.09.1", origin="bundled"):
    return {
        "id": profile_id,
        "name": "Google C++ Style",
        "origin": origin,
        "revision": revision,
        "sources": [{
            "kind": "url",
            "locator": "https://google.github.io/styleguide/cppguide.html",
            "retrievedOn": "2026-09-09",
        }],
    }


class CLITest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.home = self.root / "home"
        self.project = self.root / "project"
        self.project.mkdir()
        self.user_data = self.home / ".agents/skill-data/cpp-code-style"
        self.system_data = self.user_data / "system"
        self.organization_data = self.user_data / "organization"
        self.project_data = self.project / ".agents/skill-data/cpp-code-style"

    def write(self, path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")

    def invoke(self, *args, ok=True):
        result = subprocess.run(
            [sys.executable, "-B", str(CLI), "--project", str(self.project),
             "--user-home", str(self.home), *map(str, args)],
            capture_output=True, encoding="utf-8",
        )
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        return result

    def output(self, *args):
        return json.loads(self.invoke(*args).stdout)

    def layer(self, path, *rules, **extra):
        self.write(path / "rules.yaml", {"schemaVersion": 1, "rules": list(rules), **extra})

    def initialize_system(self):
        self.layer(self.system_data, profile=profile(), baseStyle="Google")

    def initialize_empty_layers(self):
        self.initialize_system()
        self.layer(self.user_data)
        self.layer(self.project_data)

    def organization_identity(self, org_id="jsmodel", revision="2026.09.1"):
        return {"id": org_id, "revision": revision}

    def write_organization_ref(self, org_id="jsmodel", revision="2026.09.1"):
        self.write(self.project_data / "organization.yaml", {
            "schemaVersion": 1, "id": org_id, "revision": revision,
        })

    def initialize_organization(self, *rules, org_id="jsmodel", revision="2026.09.1"):
        self.write_organization_ref(org_id, revision)
        self.layer(
            self.organization_data, *rules,
            organization=self.organization_identity(org_id, revision),
        )

    def propose(self, data, layer="project", *extra):
        source = self.root / "incoming.yaml"
        self.write(source, data)
        proposal = self.root / "proposal.json"
        result = self.invoke(
            "propose", "--layer", layer, "--input", source,
            "--proposal-file", proposal, *extra,
        )
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        return proposal, json.loads(proposal.read_text(encoding="utf-8"))

    def incoming_path(self, data, name="incoming.yaml"):
        path = self.root / name
        self.write(path, data)
        return path

    def test_proposal_file_alias_writes_full_plan_and_stdout_is_summary(self):
        self.initialize_empty_layers()
        source = self.incoming_path({"schemaVersion": 1, "rules": [rule()]})
        proposal_path = self.root / "proposal.json"
        result = self.invoke(
            "propose", "--layer", "project", "--input-file", source,
            "--proposal-file", proposal_path,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        summary = json.loads(result.stdout)
        full = json.loads(proposal_path.read_text(encoding="utf-8"))
        self.assertEqual(summary["proposalFile"], str(proposal_path.resolve()))
        self.assertEqual(summary["digest"], full["digest"])
        self.assertNotIn("before", summary["writes"][0])
        self.assertIn("before", full["writes"][0])

    def test_proposal_diff_and_quiet_modes(self):
        self.initialize_empty_layers()
        source = self.incoming_path({"schemaVersion": 1, "rules": [rule()]})
        diff_path = self.root / "diff-proposal.json"
        diff = self.invoke(
            "propose", "--layer", "project", "--input", source,
            "--out", diff_path, "--diff",
        )
        self.assertEqual(diff.returncode, 0, diff.stderr)
        self.assertIn("diff", json.loads(diff.stdout)["writes"][0])

        quiet_path = self.root / "quiet-proposal.json"
        quiet = self.invoke(
            "propose", "--layer", "project", "--input", source,
            "--out", quiet_path, "--quiet",
        )
        self.assertEqual(quiet.returncode, 0, quiet.stderr)
        self.assertEqual(quiet.stdout, "")
        self.assertTrue(quiet_path.is_file())

    def test_missing_propose_layer_shows_copyable_example(self):
        source = self.incoming_path({"schemaVersion": 1, "rules": []})
        result = self.invoke("propose", "--input-file", source, ok=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("--layer project", result.stderr)

    def test_apply_alias_and_verbose_phase_diagnostics(self):
        self.initialize_empty_layers()
        source = self.incoming_path({"schemaVersion": 1, "rules": [rule()]})
        proposal_path = self.root / "proposal.json"
        generated = self.invoke(
            "propose", "--layer", "project", "--input", source,
            "--proposal-file", proposal_path,
        )
        self.assertEqual(generated.returncode, 0, generated.stderr)
        plan = json.loads(proposal_path.read_text(encoding="utf-8"))
        applied = self.invoke(
            "apply", "--proposal-file", proposal_path, "--confirm", plan["digest"],
            "--verbose",
        )
        self.assertEqual(applied.returncode, 0, applied.stderr)
        self.assertIn("preflight", applied.stderr)
        self.assertIn("write", applied.stderr)

    def test_digest_error_identifies_provided_and_actual_values(self):
        self.initialize_empty_layers()
        source = self.incoming_path({"schemaVersion": 1, "rules": [rule()]})
        proposal_path = self.root / "proposal.json"
        generated = self.invoke(
            "propose", "--layer", "project", "--input", source,
            "--proposal-file", proposal_path,
        )
        self.assertEqual(generated.returncode, 0, generated.stderr)
        plan = json.loads(proposal_path.read_text(encoding="utf-8"))

        wrong = self.invoke(
            "apply", "--proposal-file", proposal_path, "--confirm", "wrong-digest", ok=False,
        )
        self.assertIn("providedDigest", wrong.stderr)
        self.assertIn("digest mismatch", wrong.stderr)

        plan["impact"] = "tampered"
        proposal_path.write_text(json.dumps(plan), encoding="utf-8")
        changed = self.invoke(
            "apply", "--proposal-file", proposal_path, "--confirm", plan["digest"], ok=False,
        )
        self.assertIn("proposal file was modified", changed.stderr.lower())
        self.assertIn("actualDigest", changed.stderr)

    def test_format_rule_group_is_accepted(self):
        self.layer(self.system_data, profile=profile(), baseStyle="Google", rules=[])
        self.layer(self.user_data)
        self.layer(self.project_data, rule())
        source = self.project / "a.cpp"
        source.write_text("int x;\n", encoding="utf-8")
        result = self.invoke("check", source, "--rule", "format", ok=False)
        self.assertNotEqual(result.returncode, 2)
        output = json.loads(result.stdout)
        self.assertEqual(output["results"][0]["id"], "format")
        self.assertEqual(output["results"][0]["ruleIds"], ["format.indentation"])

    def test_check_reports_automated_and_semantic_summaries(self):
        semantic = {
            "id": "comments.api-contracts", "summary": "Document contracts",
            "appliesTo": "Public C++ APIs", "enabled": True, "severity": "advisory",
            "execution": {"check": "semantic", "fix": "semantic"},
            "config": {"requirement": "Document non-obvious API contracts"},
        }
        self.layer(self.system_data, profile=profile(), baseStyle="Google", rules=[])
        self.layer(self.user_data)
        self.layer(self.project_data, semantic)
        source = self.project / "a.cpp"
        source.write_text("int x;\n", encoding="utf-8")
        result = self.invoke("check", source, ok=False)
        self.assertEqual(result.returncode, 1)
        result = json.loads(result.stdout)
        self.assertIn("automated", result)
        self.assertIn("semantic", result)
        self.assertTrue(result["semantic"]["needsReview"])
        self.assertFalse(result["complete"])

    def test_status_reports_missing_without_writing(self):
        result = self.output("status")
        self.assertFalse(result["ready"])
        self.assertEqual(
            {key: value["state"] for key, value in result["layers"].items()},
            {
                "system": "missing",
                "user": "missing",
                "organization": "unbound",
                "project": "missing",
            },
        )
        self.assertFalse(self.user_data.exists())
        self.assertFalse(self.project_data.exists())

    def test_status_treats_empty_layers_as_ready(self):
        self.initialize_empty_layers()
        result = self.output("status")
        self.assertTrue(result["ready"])
        self.assertEqual(result["layers"]["organization"]["state"], "unbound")
        self.assertTrue(all(
            result["layers"][name]["state"] == "empty"
            for name in ("system", "user", "project")
        ))

    def test_status_reports_invalid_without_overwriting(self):
        path = self.user_data / "rules.yaml"
        path.parent.mkdir(parents=True)
        path.write_text("schemaVersion: 1\nrules: [", encoding="utf-8")
        before = path.read_bytes()
        result = self.output("status")
        self.assertEqual(result["layers"]["user"]["state"], "invalid")
        self.assertEqual(path.read_bytes(), before)

    def test_profile_is_required_only_for_system(self):
        self.layer(self.system_data, baseStyle="Google")
        self.assertEqual(self.output("status")["layers"]["system"]["state"], "invalid")
        self.layer(self.system_data, profile=profile(), baseStyle="Google")
        self.layer(self.user_data, profile=profile())
        self.assertEqual(self.output("status")["layers"]["user"]["state"], "invalid")

    def test_system_requires_base_style(self):
        self.layer(self.system_data, profile=profile())
        self.assertEqual(self.output("status")["layers"]["system"]["state"], "invalid")

    def test_status_marks_missing_detail_invalid(self):
        item = rule()
        item.pop("config")
        item["detail"] = "details/missing.yaml"
        self.layer(self.project_data, item)
        result = self.output("status")
        self.assertEqual(result["layers"]["project"]["state"], "invalid")

    def test_check_requires_complete_initialization(self):
        source = self.project / "a.cpp"
        source.write_text("int x;\n", encoding="utf-8")
        result = self.invoke("check", source, ok=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("not initialized", result.stderr)

    def test_system_proposal_initializes_missing_baseline(self):
        incoming = {
            "schemaVersion": 1,
            "profile": profile(),
            "baseStyle": "Google",
            "rules": [],
        }
        proposal, plan = self.propose(incoming, "system")
        result = self.output("apply", "--proposal", proposal, "--confirm", plan["digest"])
        stored = yaml.safe_load((self.system_data / "rules.yaml").read_text(encoding="utf-8"))
        self.assertEqual(result["layer"], "system")
        self.assertEqual(stored["profile"]["id"], "google")
        self.assertEqual(stored["baseStyle"], "Google")

    def test_custom_system_proposal_records_user_maintained_source(self):
        custom = profile("team-guide", "manual-1", origin="custom")
        custom["name"] = "Team C++ Guide"
        custom["sources"] = [{
            "kind": "document",
            "locator": "Team C++ handbook supplied by the user",
            "retrievedOn": "2026-09-09",
        }]
        proposal, plan = self.propose({
            "schemaVersion": 1,
            "profile": custom,
            "baseStyle": "Google",
            "rules": [],
        }, "system")
        self.output("apply", "--proposal", proposal, "--confirm", plan["digest"])
        stored = yaml.safe_load((self.system_data / "rules.yaml").read_text(encoding="utf-8"))
        self.assertEqual(stored["profile"]["origin"], "custom")
        self.assertEqual(stored["profile"]["sources"][0]["kind"], "document")

    def test_profile_is_rejected_from_non_system_proposals(self):
        incoming = self.incoming_path({
            "schemaVersion": 1,
            "profile": profile(),
            "rules": [],
        })
        for layer in ("user", "organization", "project"):
            result = self.invoke("propose", "--layer", layer, "--input", incoming, ok=False)
            self.assertEqual(result.returncode, 2)

    def test_system_proposal_is_stale_after_system_change(self):
        incoming = {
            "schemaVersion": 1,
            "profile": profile(),
            "baseStyle": "Google",
            "rules": [],
        }
        proposal, plan = self.propose(incoming, "system")
        self.layer(self.system_data, profile=profile(revision="manual"), baseStyle="Google")
        result = self.invoke("apply", "--proposal", proposal, "--confirm", plan["digest"], ok=False)
        self.assertEqual(result.returncode, 2)

    def write_catalog(self, revision="2026.09.2", package_path="google/rules.yaml",
                      package_revision=None):
        root = self.root / "catalog"
        package_revision = package_revision or revision
        if not package_path.startswith("../"):
            self.write(root / package_path, {
                "schemaVersion": 1,
                "profile": profile(revision=package_revision),
                "baseStyle": "Google",
                "rules": [],
            })
        index = root / "index.yaml"
        self.write(index, {
            "schemaVersion": 1,
            "defaultProfile": "google",
            "profiles": [{
                "id": "google",
                "name": "Google C++ Style",
                "revision": revision,
                "path": package_path,
                "summary": "Curated Google C++ baseline",
                "coverage": {
                    "included": ["headers", "naming"],
                    "omitted": ["google-internal-libraries"],
                },
            }],
        })
        return index

    def test_catalog_reports_newer_matching_bundled_profile(self):
        self.initialize_empty_layers()
        catalog = self.write_catalog(revision="2026.09.2")
        result = self.output("status", "--catalog", catalog)
        self.assertTrue(result["ready"])
        self.assertTrue(result["upgradeAvailable"])
        self.assertEqual(result["upgrade"]["currentRevision"], "2026.09.1")
        self.assertEqual(result["upgrade"]["candidateRevision"], "2026.09.2")

    def test_catalog_does_not_offer_upgrade_for_custom_profile(self):
        self.initialize_empty_layers()
        data = yaml.safe_load((self.system_data / "rules.yaml").read_text(encoding="utf-8"))
        data["profile"]["origin"] = "custom"
        self.write(self.system_data / "rules.yaml", data)
        result = self.output("status", "--catalog", self.write_catalog())
        self.assertFalse(result["upgradeAvailable"])

    def test_catalog_rejects_escape_and_profile_mismatch(self):
        escaped = self.write_catalog(package_path="../rules.yaml")
        self.assertEqual(self.invoke("status", "--catalog", escaped, ok=False).returncode, 2)

        mismatch = self.write_catalog(package_revision="different")
        self.assertEqual(self.invoke("status", "--catalog", mismatch, ok=False).returncode, 2)

    def install_google_system(self):
        proposal = self.root / "system.json"
        result = self.invoke(
            "propose", "--layer", "system", "--input", GOOGLE,
            "--proposal-file", proposal,
        )
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        plan = json.loads(proposal.read_text(encoding="utf-8"))
        self.output("apply", "--proposal", proposal, "--confirm", plan["digest"])

    def test_shipped_google_profile_initializes_system_offline(self):
        self.install_google_system()
        self.layer(self.user_data)
        self.layer(self.project_data)
        status = self.output("status", "--catalog", CATALOG)
        self.assertTrue(status["ready"])
        self.assertFalse(status["upgradeAvailable"])
        self.assertEqual(
            yaml.safe_load((self.system_data / "rules.yaml").read_text(encoding="utf-8"))["baseStyle"],
            "Google",
        )

    def test_shipped_jsmodel_organization_pack_binds_current_project(self):
        self.initialize_empty_layers()
        proposal = self.root / "organization.json"
        result = self.invoke(
            "propose", "--layer", "organization", "--input", JSMODEL,
            "--proposal-file", proposal,
        )
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        plan = json.loads(proposal.read_text(encoding="utf-8"))
        self.output("apply", "--proposal", proposal, "--confirm", plan["digest"])
        status = self.output("status")
        self.assertTrue(status["ready"])
        self.assertEqual(status["layers"]["organization"]["state"], "valid")
        self.assertEqual(status["layers"]["organization"]["id"], "jsmodel")
        self.assertEqual(self.output("get", "naming.variables")["layer"], "organization")

    def test_shipped_google_profile_is_progressively_disclosed(self):
        self.install_google_system()
        listed = self.output("list", "--layer", "system")
        self.assertTrue(listed["rules"])
        self.assertTrue(all("config" not in item for item in listed["rules"]))
        detail = self.output("get", "language.type-deduction", "--layer", "system")
        self.assertIn("requirement", detail["rule"]["config"])

    def test_manager_has_no_duplicate_cli_implementation(self):
        self.assertTrue(CLI.is_file())
        self.assertFalse((MANAGER / "scripts").exists())

    def test_complete_initialization_then_query_and_check(self):
        proposal = self.root / "system.json"
        result = self.invoke(
            "propose", "--layer", "system", "--input", GOOGLE,
            "--proposal-file", proposal,
        )
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        plan = json.loads(proposal.read_text(encoding="utf-8"))
        self.output("apply", "--proposal", proposal, "--confirm", plan["digest"])
        self.layer(self.user_data)
        self.layer(self.project_data)

        self.assertTrue(self.output("status", "--catalog", CATALOG)["ready"])
        self.assertEqual(self.output("get", "naming.variables")["layer"], "system")

        source = self.project / "sample.cpp"
        source.write_text("int value = 0;\n", encoding="utf-8")
        result = self.invoke("check", source, "--rule", "naming.variables", ok=False)
        self.assertEqual(json.loads(result.stdout)["results"][0]["status"], "needs-review")

    def test_project_wins_and_list_does_not_disclose_config(self):
        self.layer(self.user_data, rule(options={"IndentWidth": 2}))
        self.layer(self.project_data, rule(options={"IndentWidth": 8}))
        result = self.output("list")
        self.assertEqual(result["rules"][0]["layer"], "project")
        self.assertNotIn("config", result["rules"][0])
        self.assertEqual(self.output("get", "format.indentation")["rule"]["config"]["options"]["IndentWidth"], 8)
        self.assertEqual([r["layer"] for r in self.output("explain", "format.indentation")["chain"]], ["user", "project"])

    def test_list_does_not_open_detail_but_get_requires_it(self):
        item = rule()
        item.pop("config")
        item["detail"] = "details/missing.yaml"
        self.layer(self.project_data, item)
        self.assertEqual(len(self.output("list")["rules"]), 1)
        self.assertNotEqual(self.invoke("get", item["id"], ok=False).returncode, 0)

    def test_disable_and_unset_are_different(self):
        self.layer(self.user_data, rule(options={"IndentWidth": 2}))
        disabled = rule()
        disabled["enabled"] = False
        self.layer(self.project_data, disabled)
        self.assertFalse(self.output("get", disabled["id"])["rule"]["enabled"])
        path = self.root / "unset.json"
        result = self.invoke(
            "propose", "--layer", "project", "--unset", disabled["id"],
            "--proposal-file", path,
        )
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        plan = json.loads(path.read_text(encoding="utf-8"))
        self.output("apply", "--proposal", path, "--confirm", plan["digest"])
        self.assertEqual(self.output("get", disabled["id"])["layer"], "user")

    def test_confirmation_required_and_write_reports_effective_source(self):
        self.layer(self.project_data, rule(options={"IndentWidth": 8}))
        path, plan = self.propose({"schemaVersion": 1, "rules": [rule()]}, "user")
        self.assertFalse((self.user_data / "rules.yaml").exists())
        self.assertNotEqual(self.invoke("apply", "--proposal", path, ok=False).returncode, 0)
        result = self.output("apply", "--proposal", path, "--confirm", plan["digest"])
        self.assertTrue((self.user_data / "rules.yaml").exists())
        self.assertEqual(result["effective"][0]["layer"], "project")
        self.assertNotIn("note", result)

    def test_detail_change_invalidates_proposal(self):
        item = rule()
        config = item.pop("config")
        item["detail"] = "details/indent.yaml"
        self.layer(self.project_data, item)
        detail = self.project_data / item["detail"]
        self.write(detail, {"id": item["id"], "config": config})
        path, plan = self.propose({"schemaVersion": 1, "rules": [rule(options={"IndentWidth": 8})]})
        self.write(detail, {"id": item["id"], "config": {"handler": "clang-format", "options": {"IndentWidth": 3}}})
        self.assertNotEqual(self.invoke("apply", "--proposal", path, "--confirm", plan["digest"], ok=False).returncode, 0)

    def test_stale_error_identifies_changed_rules_and_hashes(self):
        self.initialize_empty_layers()
        source = self.incoming_path({"schemaVersion": 1, "rules": [rule()]})
        proposal_path = self.root / "proposal.json"
        generated = self.invoke(
            "propose", "--layer", "project", "--input", source,
            "--proposal-file", proposal_path,
        )
        self.assertEqual(generated.returncode, 0, generated.stderr)
        plan = json.loads(proposal_path.read_text(encoding="utf-8"))
        self.layer(self.project_data, rule(options={"IndentWidth": 2}))
        result = self.invoke(
            "apply", "--proposal-file", proposal_path, "--confirm", plan["digest"], ok=False,
        )
        self.assertIn("rules changed", result.stderr)
        self.assertIn("expectedHash", result.stderr)
        self.assertIn("actualHash", result.stderr)

    def test_write_failure_reports_target_and_operation(self):
        self.initialize_empty_layers()
        source = self.incoming_path({"schemaVersion": 1, "rules": [rule()]})
        proposal_path = self.root / "proposal.json"
        generated = self.invoke(
            "propose", "--layer", "project", "--input", source,
            "--proposal-file", proposal_path,
        )
        self.assertEqual(generated.returncode, 0, generated.stderr)
        plan = json.loads(proposal_path.read_text(encoding="utf-8"))
        target = self.project_data / "details" / "blocked.yaml"
        target.mkdir(parents=True)
        plan["writes"] = [{
            "path": str(target), "beforeHash": None, "before": None,
            "after": "id: blocked\n", "diff": "",
        }]
        body = {key: value for key, value in plan.items() if key != "digest"}
        plan["digest"] = digest(body)
        proposal_path.write_text(json.dumps(plan), encoding="utf-8")
        result = self.invoke(
            "apply", "--proposal-file", proposal_path, "--confirm", plan["digest"], ok=False,
        )
        error = json.loads(result.stderr)["error"]
        self.assertIn("Write failed", error)
        self.assertIn("replace", error)
        self.assertIn(str(target), error)
        self.assertTrue(target.is_dir())

    def test_tampered_plan_is_rejected(self):
        path, plan = self.propose({"schemaVersion": 1, "rules": [rule()]})
        plan["writes"][0]["after"] += "\n# tampered\n"
        path.write_text(json.dumps(plan), encoding="utf-8")
        self.assertNotEqual(self.invoke("apply", "--proposal", path, "--confirm", plan["digest"], ok=False).returncode, 0)
        self.assertFalse((self.project_data / "rules.yaml").exists())

    def test_duplicate_ids_and_path_escape_are_rejected(self):
        self.layer(self.project_data, rule(), rule())
        self.assertNotEqual(self.invoke("validate", ok=False).returncode, 0)
        item = rule()
        item.pop("config")
        item["detail"] = "../outside.yaml"
        self.layer(self.project_data, item)
        self.assertNotEqual(self.invoke("validate", ok=False).returncode, 0)

    def test_duplicate_yaml_keys_rejected(self):
        path = self.project_data / "rules.yaml"
        path.parent.mkdir(parents=True)
        path.write_text("schemaVersion: 1\nrules: []\nrules: []\n", encoding="utf-8")
        self.assertNotEqual(self.invoke("list", ok=False).returncode, 0)

    def test_unknown_format_handler_is_not_reported_as_pass(self):
        self.initialize_empty_layers()
        item = rule()
        item["config"] = {"handler": "not-installed"}
        self.layer(self.project_data, item)
        source = self.project / "a.cpp"
        source.write_text("int x;\n")
        result = self.invoke("check", source, ok=False)
        self.assertEqual(next(r for r in json.loads(result.stdout)["results"] if r["id"] == item["id"])["status"], "not-executed")

    def test_semantic_check_is_pending(self):
        self.initialize_empty_layers()
        item = rule("comments.intent")
        item["execution"] = {"check": "semantic", "fix": "semantic"}
        item["config"] = {"requirement": "Explain ownership accurately"}
        self.layer(self.project_data, item)
        source = self.project / "a.cpp"
        source.write_text("int x;\n")
        result = self.invoke("check", source, ok=False)
        self.assertEqual(next(r for r in json.loads(result.stdout)["results"] if r["id"] == item["id"])["status"], "needs-review")

    def test_upsert_preserves_unrelated_rules_and_equal_overrides(self):
        other = rule("format.width", {"ColumnLimit": 120})
        self.layer(self.user_data, rule())
        self.layer(self.project_data, rule(), other)
        path, plan = self.propose({"schemaVersion": 1, "rules": [rule()]})
        self.output("apply", "--proposal", path, "--confirm", plan["digest"])
        rules = self.output("list")["rules"]
        self.assertEqual(len(rules), 2)
        self.assertTrue(all(r["layer"] == "project" for r in rules))

    @unittest.skipUnless(shutil.which("clang-format"), "clang-format not installed")
    def test_real_formatter_export_check_and_fix(self):
        self.initialize_empty_layers()
        self.layer(self.user_data, rule(options={"IndentWidth": 2, "UseTab": "Never"}), baseStyle="LLVM")
        self.layer(self.project_data, rule(options={"IndentWidth": 4, "UseTab": "Never"}))
        exported = self.output("export")
        self.assertEqual(yaml.safe_load(exported["content"])["IndentWidth"], 4)
        source = self.project / "a.cpp"
        source.write_text("int main(){return 0;}\n")
        before = source.read_bytes()
        result = self.invoke("check", source, ok=False)
        self.assertEqual(json.loads(result.stdout)["results"][0]["status"], "violation")
        self.assertEqual(source.read_bytes(), before)
        fixed = self.output("check", source, "--fix")
        self.assertEqual(fixed["results"][0]["status"], "pass")
        self.assertEqual(self.output("check", source)["results"][0]["status"], "pass")

    def test_utf8_bom_and_invalid_bytes_are_violations(self):
        self.initialize_empty_layers()
        item = rule("files.encoding")
        item["config"] = {"handler": "utf8-no-bom"}
        item["execution"]["fix"] = "unavailable"
        self.layer(self.project_data, item)
        source = self.project / "a.cpp"
        for content in (b"\xef\xbb\xbfint x;\n", b"\xff"):
            source.write_bytes(content)
            result = self.invoke("check", source, ok=False)
            self.assertEqual(next(r for r in json.loads(result.stdout)["results"] if r["id"] == item["id"])["status"], "violation")
            self.assertEqual(source.read_bytes(), content)


    def test_synthetic_layer_fixtures_import_and_keep_scope(self):
        self.initialize_system()
        fixtures = Path(__file__).parent / "fixtures" / "layers"
        for layer in ("user", "project"):
            result = self.invoke(
                "propose", "--layer", layer,
                "--input", fixtures / layer / "rules.yaml",
                "--proposal-file", self.root / f"{layer}.json",
            )
            proposal = self.root / f"{layer}.json"
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            plan = json.loads(proposal.read_text(encoding="utf-8"))
            self.output("apply", "--proposal", proposal, "--confirm", plan["digest"])
        self.assertTrue(self.output("validate")["valid"])
        private = self.output("get", "naming.model-private-field")
        self.assertEqual(private["rule"]["overrides"], ["naming.struct-field"])
        self.assertEqual(private["layer"], "project")
        self.assertEqual(self.output("get", "naming.struct-field")["layer"], "user")

    def test_duplicate_format_leaf_and_cyclic_overrides_are_rejected(self):
        self.initialize_empty_layers()
        self.layer(self.project_data, rule(), rule("format.other"))
        self.assertNotEqual(self.invoke("validate", ok=False).returncode, 0)
        one, two = rule("a"), rule("b", {"ColumnLimit": 100})
        one["overrides"], two["overrides"] = ["b"], ["a"]
        self.layer(self.project_data, one, two)
        self.assertNotEqual(self.invoke("validate", ok=False).returncode, 0)

    def test_proposal_cannot_overwrite_rules_via_out(self):
        self.layer(self.project_data, rule())
        target = self.project_data / "rules.yaml"
        before = target.read_bytes()
        result = self.invoke("propose", "--layer", "project", "--base-style", "Google", "--out", target, ok=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(target.read_bytes(), before)

    def test_unavailable_formatter_rule_remains_unexecuted(self):
        self.initialize_empty_layers()
        item = rule()
        item["execution"]["check"] = "unavailable"
        self.layer(self.project_data, item)
        source = self.project / "a.cpp"
        source.write_text("int x;\n")
        result = self.invoke("check", source, ok=False)
        self.assertEqual(json.loads(result.stdout)["results"][0]["status"], "not-executed")

    @unittest.skipUnless(shutil.which("clang-format"), "clang-format not installed")
    def test_partial_format_fix_respects_other_rules_fix_policy(self):
        self.initialize_empty_layers()
        blocked = rule("format.width", {"ColumnLimit": 120})
        blocked["execution"]["fix"] = "semantic"
        self.layer(self.project_data, rule(), blocked)
        source = self.project / "a.cpp"
        source.write_text("int main(){return 0;}\n")
        before = source.read_bytes()
        self.invoke("check", source, "--rule", "format.indentation", "--fix", ok=False)
        self.assertEqual(source.read_bytes(), before)

    def test_replacing_detail_with_inline_cleans_only_owned_detail(self):
        item = rule()
        config = item.pop("config")
        item["detail"] = "details/indent.yaml"
        self.layer(self.project_data, item)
        detail = self.project_data / item["detail"]
        self.write(detail, {"id": item["id"], "config": config})
        unrelated = self.project_data / "details/notes.yaml"
        self.write(unrelated, {"note": "keep"})
        path, plan = self.propose({"schemaVersion": 1, "rules": [rule()]})
        self.output("apply", "--proposal", path, "--confirm", plan["digest"])
        self.assertFalse(detail.exists())
        self.assertTrue(unrelated.exists())

    def test_empty_base_query_does_not_create_data_directories(self):
        data = self.output("list")
        self.assertNotIn("baseStyle", data["settings"])
        self.assertFalse(self.user_data.exists())
        self.assertFalse(self.project_data.exists())


    @unittest.skipUnless(shutil.which("clang-format"), "clang-format not installed")
    def test_nonformat_rule_does_not_suppress_system_baseline(self):
        self.initialize_empty_layers()
        item = rule("files.encoding")
        item["config"] = {"handler": "utf8-no-bom"}
        item["execution"]["fix"] = "unavailable"
        self.layer(self.project_data, item)
        source = self.project / "a.cpp"
        source.write_text("int main(){return 0;}\n")
        result = self.invoke("check", source, ok=False)
        output = json.loads(result.stdout)
        self.assertFalse(output["complete"])
        self.assertEqual(next(r for r in output["results"] if r["id"] == "format")["status"], "violation")

    @unittest.skipUnless(shutil.which("clang-format"), "clang-format not installed")
    def test_unchanged_export_target_is_still_watched(self):
        self.initialize_empty_layers()
        self.layer(self.project_data, rule())
        target = self.project / ".clang-format"
        target.write_text(self.output("export")["content"], encoding="utf-8", newline="\n")
        source = rule("comments.intent")
        source["execution"] = {"check": "semantic", "fix": "semantic"}
        source["config"] = {"requirement": "Explain ownership"}
        path, plan = self.propose({"schemaVersion": 1, "rules": [source]}, "project", "--with-format")
        self.assertFalse(any(w["path"] == str(target) for w in plan["writes"]))
        target.write_text("BasedOnStyle: Google\n", encoding="utf-8")
        result = self.invoke("apply", "--proposal", path, "--confirm", plan["digest"], ok=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("comments.intent", (self.project_data / "rules.yaml").read_text())

    def test_equivalent_detail_path_does_not_delete_retained_file(self):
        item = rule()
        config = item.pop("config")
        item["detail"] = "details/indent.yaml"
        self.layer(self.project_data, item)
        body = {"id": item["id"], "config": config}
        self.write(self.project_data / item["detail"], body)
        incoming = self.root / "incoming/rules.yaml"
        item["detail"] = "details/./indent.yaml"
        self.write(incoming, {"schemaVersion": 1, "rules": [item]})
        self.write(incoming.parent / "details/indent.yaml", body)
        path = self.root / "alias.json"
        result = self.invoke(
            "propose", "--layer", "project", "--input", incoming,
            "--proposal-file", path,
        )
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        plan = json.loads(path.read_text(encoding="utf-8"))
        self.output("apply", "--proposal", path, "--confirm", plan["digest"])
        self.assertEqual(self.output("get", item["id"])["rule"]["config"], config)

    def test_unbound_organization_cache_is_ignored(self):
        self.initialize_empty_layers()
        self.layer(
            self.organization_data, rule(options={"IndentWidth": 2}),
            organization=self.organization_identity(),
        )
        self.layer(self.user_data, rule(options={"IndentWidth": 8}))
        result = self.output("list")
        self.assertEqual(result["rules"][0]["layer"], "user")
        self.assertEqual(self.output("status")["layers"]["organization"]["state"], "unbound")

    def test_bound_missing_organization_cache_is_not_ready(self):
        self.initialize_empty_layers()
        self.write_organization_ref()
        result = self.output("status")
        self.assertFalse(result["ready"])
        self.assertEqual(result["layers"]["organization"]["state"], "missing")

    def test_organization_identity_mismatch_is_invalid(self):
        self.initialize_empty_layers()
        self.write_organization_ref(revision="2026.09.1")
        self.layer(
            self.organization_data, rule(),
            organization=self.organization_identity(revision="other"),
        )
        result = self.output("status")
        self.assertFalse(result["ready"])
        self.assertEqual(result["layers"]["organization"]["state"], "invalid")
        self.assertIn("revision", result["layers"]["organization"]["error"])

    def test_organization_overrides_user_and_loses_to_project(self):
        self.initialize_system()
        self.layer(self.user_data, rule(options={"IndentWidth": 2}))
        self.initialize_organization(rule(options={"IndentWidth": 4}))
        self.layer(self.project_data)
        self.assertEqual(self.output("get", "format.indentation")["layer"], "organization")
        self.assertEqual(
            [item["layer"] for item in self.output("explain", "format.indentation")["chain"]],
            ["user", "organization"],
        )
        self.layer(self.project_data, rule(options={"IndentWidth": 8}))
        self.assertEqual(self.output("get", "format.indentation")["layer"], "project")
        self.assertEqual(
            [item["layer"] for item in self.output("explain", "format.indentation")["chain"]],
            ["user", "organization", "project"],
        )

    def test_organization_proposal_writes_cache_and_project_reference(self):
        self.initialize_empty_layers()
        incoming = {
            "schemaVersion": 1,
            "organization": self.organization_identity(),
            "rules": [rule(options={"IndentWidth": 4})],
        }
        proposal, plan = self.propose(incoming, "organization")
        self.assertEqual(plan["impact"], "Projects that bind this organization identity")
        result = self.output("apply", "--proposal", proposal, "--confirm", plan["digest"])
        self.assertEqual(result["layer"], "organization")
        stored = yaml.safe_load((self.organization_data / "rules.yaml").read_text(encoding="utf-8"))
        self.assertEqual(stored["organization"]["id"], "jsmodel")
        ref = yaml.safe_load((self.project_data / "organization.yaml").read_text(encoding="utf-8"))
        self.assertEqual(ref, {"schemaVersion": 1, "id": "jsmodel", "revision": "2026.09.1"})
        self.assertEqual(self.output("get", "format.indentation")["layer"], "organization")

    def test_organization_rejects_profile_and_base_style(self):
        self.initialize_empty_layers()
        incoming = self.incoming_path({
            "schemaVersion": 1,
            "organization": self.organization_identity(),
            "baseStyle": "Google",
            "rules": [],
        })
        result = self.invoke("propose", "--layer", "organization", "--input", incoming, ok=False)
        self.assertEqual(result.returncode, 2)
        self.layer(
            self.organization_data,
            organization=self.organization_identity(),
            profile=profile(),
        )
        self.write_organization_ref()
        self.assertEqual(self.output("status")["layers"]["organization"]["state"], "invalid")


if __name__ == "__main__":
    unittest.main()
