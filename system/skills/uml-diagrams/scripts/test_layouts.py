from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from activitylayout import render as render_activity  # noqa: E402
from classlayout import render as render_class  # noqa: E402
from ipolayout import render as render_ipo  # noqa: E402
from architecturelayout import render as render_architecture  # noqa: E402
from communicationlayout import render as render_communication  # noqa: E402
from objectlayout import render as render_object  # noqa: E402
from statemachinelayout import main as state_main  # noqa: E402
from timinglayout import render as render_timing  # noqa: E402
from usecaselayout import render as render_usecase  # noqa: E402
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
        self.assertIn("fontSize=18", xml)
        self.assertIn("pageWidth=", xml)

    def test_class_renders_signatures_and_separate_anchors(self) -> None:
        xml = render_class({
            "nodes": [
                {
                    "id": "radar",
                    "label": "陆基雷达组件",
                    "attributes": [{"visibility": "private", "name": "扫描扇面", "type": "度"}],
                    "operations": [{
                        "visibility": "public",
                        "name": "周期探测",
                        "parameters": [{"name": "仿真时间", "type": "秒"}],
                        "returnType": "观测结果",
                    }],
                },
                {"id": "base", "label": "通用雷达"},
                {"id": "jam", "label": "雷达干扰组件"},
            ],
            "edges": [
                {"source": "radar", "target": "base", "label": "继承", "kind": "inheritance"},
                {"source": "radar", "target": "jam", "label": "读取", "kind": "dependency"},
            ],
        }, "fig-class")
        self.assertIn("- 扫描扇面: 度", xml)
        self.assertIn("+ 周期探测(仿真时间: 秒): 观测结果", xml)
        self.assertIn("endFill=0", xml)
        self.assertIn("dashed=1", xml)
        self.assertIn("exitY=0.333", xml)
        self.assertIn("exitY=0.667", xml)

    def test_ipo_splits_items_into_separate_boxes(self) -> None:
        xml = render_ipo({
            "inputs": ["工作与扫描装订", "指定跟踪集合"],
            "steps": ["判定工作状态"],
            "outputs": ["平台原点观测"],
        })
        self.assertEqual(xml.count('value="工作与扫描装订"'), 1)
        self.assertEqual(xml.count('value="指定跟踪集合"'), 1)
        self.assertIn('value="输入"', xml)
        self.assertNotIn("工作与扫描装订&#xa;指定跟踪集合", xml)

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

    def test_object_diagram_underlines_instance_name(self) -> None:
        xml = render_object({"nodes": [{"id": "o", "name": "order1", "class": "Order", "slots": ["total = 40"]}]})
        self.assertIn("order1 : Order", xml)
        self.assertIn("fontStyle=5", xml)
        self.assertIn("total = 40", xml)

    def test_use_case_keeps_actor_outside_boundary(self) -> None:
        xml = render_usecase({
            "system": "订单",
            "actors": [{"id": "user", "label": "顾客"}],
            "usecases": [{"id": "pay", "label": "付款"}, {"id": "auth", "label": "鉴权"}],
            "edges": [{"source": "pay", "target": "auth", "kind": "include"}],
        })
        self.assertIn("shape=umlActor", xml)
        self.assertIn("ellipse", xml)
        self.assertIn("«include»", xml)
        self.assertIn('x="60"', xml)
        self.assertIn('x="220"', xml)

    def test_activity_separates_fork_channels(self) -> None:
        xml = render_activity({
            "lanes": [{"id": "buyer", "label": "顾客"}, {"id": "shop", "label": "系统"}],
            "nodes": [
                {"id": "start", "kind": "initial", "lane": "buyer"},
                {"id": "fork", "kind": "fork", "lane": "buyer"},
                {"id": "pay", "kind": "action", "label": "付款", "lane": "buyer"},
                {"id": "stock", "kind": "action", "label": "扣库存", "lane": "shop"},
            ],
            "edges": [
                {"source": "fork", "target": "pay"},
                {"source": "fork", "target": "stock"},
            ],
        })
        self.assertIn("fillColor=#333333", xml)
        self.assertEqual(xml.count('id="e0"'), 1)
        self.assertNotEqual(
            xml.split('id="e0"')[1].split("</mxCell>")[0],
            xml.split('id="e1"')[1].split("</mxCell>")[0],
        )

    def test_architecture_routes_query_and_response_apart(self) -> None:
        xml = render_architecture({
            "layers": [
                {"id": "platform", "label": "仿真系统", "nodes": [{"id": "query", "label": "查询通道"}]},
                {"id": "sensor", "label": "传感器", "nodes": [{"id": "camera", "label": "传感器"}]},
            ],
            "edges": [
                {"source": "camera", "target": "query", "kind": "query", "label": "查询"},
                {"source": "query", "target": "camera", "kind": "response", "label": "响应"},
            ],
        })
        query = xml.split('value="查询"')[1].split("</mxCell>")[0]
        response = xml.split('value="响应"')[1].split("</mxCell>")[0]
        self.assertIn('x="24"', query)
        self.assertIn("dashed=1", response)
        self.assertNotIn('x="24"', response)

    def test_communication_numbers_messages(self) -> None:
        xml = render_communication({
            "objects": [{"id": "a", "name": "a", "class": "Client"}, {"id": "b", "name": "b", "class": "Server"}],
            "messages": [{"from": "a", "to": "b", "label": "ping"}],
        })
        self.assertIn("1: ping", xml)
        self.assertIn("fontStyle=4", xml)

    def test_timing_steps_vertically_on_shared_ticks(self) -> None:
        xml = render_timing({
            "ticks": ["t0", "t1", "t2"],
            "lifelines": [{"id": "clk", "label": "时钟", "states": ["低", "高", "低"]}],
        })
        self.assertIn('value="t0"', xml)
        self.assertIn('value="t2"', xml)
        self.assertIn('id="wave_0"', xml)
        self.assertIn("<Array as=\"points\">", xml)


if __name__ == "__main__":
    unittest.main()
