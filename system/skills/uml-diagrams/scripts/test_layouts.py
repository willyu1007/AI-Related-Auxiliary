from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from statemachinelayout import main as state_main  # noqa: E402
from workflowlayout import render  # noqa: E402


class LayoutScriptTest(unittest.TestCase):
    def test_workflow_uses_text_terminators(self) -> None:
        xml = render(
            {
                "nodes": [
                    {"id": "start", "label": "开始", "kind": "start"},
                    {"id": "end", "label": "结束", "kind": "end"},
                ],
                "edges": [{"source": "start", "target": "end"}],
            }
        )
        self.assertIn('value="开始"', xml)
        self.assertIn('value="结束"', xml)
        self.assertIn("arcSize=50", xml)
        self.assertNotIn("ellipse", xml)

    def test_state_machine_maps_states_and_transitions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "state-test.json"
            output = Path(directory) / "state-test.drawio"
            source.write_text(
                '{"states":[{"id":"start","label":"开始","kind":"start"},{"id":"run","label":"运行"}],"transitions":[{"source":"start","target":"run","label":"启动"}]}',
                encoding="utf-8",
            )
            old_argv = sys.argv
            try:
                sys.argv = ["statemachinelayout.py", str(source), "-o", str(output)]
                self.assertEqual(state_main(), 0)
                xml = output.read_text(encoding="utf-8")
                self.assertIn('value="运行"', xml)
                self.assertIn('value="启动"', xml)
            finally:
                sys.argv = old_argv


if __name__ == "__main__":
    unittest.main()
