#!/usr/bin/env python3
"""从流程图内容 JSON 生成 draw.io；开始/结束节点使用文字扁圆。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape


def _attr(value: object) -> str:
    return escape(str(value), {'"': "&quot;", "\n": "&#xa;"})


def render(graph: dict) -> str:
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for index, node in enumerate(nodes, start=2):
        node_id = str(node["id"])
        label = node.get("label", node_id)
        kind = node.get("kind", "process")
        if kind in {"start", "end", "terminator"}:
            style = "rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#ffffff;strokeColor=#333333;strokeWidth=2;"
        elif kind == "decision":
            style = "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;"
        else:
            style = "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;"
        x = int(node.get("x", 80 + (index - 2) % 3 * 220))
        y = int(node.get("y", 80 + (index - 2) // 3 * 120))
        w = int(node.get("width", 140))
        h = int(node.get("height", 56))
        cells.append(f'<mxCell id="{_attr(node_id)}" value="{_attr(label)}" style="{style}" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
    for index, edge in enumerate(edges, start=1000):
        cells.append(f'<mxCell id="e{index}" value="{_attr(edge.get("label", ""))}" style="html=1;endArrow=block;rounded=0;" edge="1" parent="1" source="{_attr(edge["source"])}" target="{_attr(edge["target"])}"><mxGeometry relative="1" as="geometry"/></mxCell>')
    return '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="workflow"><mxGraphModel><root>' + "".join(cells) + "</root></mxGraphModel></diagram></mxfile>"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(render(json.loads(args.input.read_text(encoding="utf-8"))), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
