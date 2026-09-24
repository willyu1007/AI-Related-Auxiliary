#!/usr/bin/env python3
"""从对象图内容 JSON 生成 draw.io。实例框沿用类图三栏样式，标题带下划线。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

BOX = (
    "swimlane;fontStyle=5;align=center;verticalAlign=top;horizontal=1;startSize=32;"
    "whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#355E8D;strokeWidth=2;fontSize=14;"
)
SLOT = (
    "text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=left;"
    "spacingLeft=8;spacingRight=8;fontSize=14;fontStyle=0;"
)
EDGE = (
    "edgeStyle=orthogonalEdgeStyle;html=1;rounded=0;endArrow=block;endFill=1;"
    "strokeColor=#333333;strokeWidth=2;labelBackgroundColor=#ffffff;"
)


def _attr(value: object) -> str:
    return escape(str(value), {'"': "&quot;", "\n": "&#xa;"})


def render(graph: dict) -> str:
    nodes = graph.get("nodes", [])
    if not nodes:
        raise ValueError("object graph has no nodes")
    boxes: dict[str, dict] = {}
    x = 80
    for node in nodes:
        slots = [str(item) for item in node.get("slots", [])]
        name = f"{node.get('name', node['id'])} : {node.get('class', '')}".strip()
        width = max(180, 16 + max([len(name), *[len(item) for item in slots]], default=0) * 8)
        height = 32 + max(1, len(slots)) * 22 + 16
        boxes[node["id"]] = {"x": x, "y": 80, "width": width, "height": height, "name": name, "slots": slots}
        x += width + 80
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for node_id, box in boxes.items():
        cells.append(
            f'<mxCell id="{_attr(node_id)}" value="{_attr(box["name"])}" style="{BOX}" vertex="1" parent="1">'
            f'<mxGeometry x="{box["x"]}" y="{box["y"]}" width="{box["width"]}" height="{box["height"]}" as="geometry"/>'
            "</mxCell>"
        )
        cells.append(
            f'<mxCell id="{_attr(node_id)}__slots" value="{_attr(chr(10).join(box["slots"]))}" style="{SLOT}" vertex="1" parent="{_attr(node_id)}">'
            f'<mxGeometry x="0" y="32" width="{box["width"]}" height="{box["height"] - 32}" as="geometry"/>'
            "</mxCell>"
        )
    for index, edge in enumerate(graph.get("edges", [])):
        source = boxes[edge["source"]]
        target = boxes[edge["target"]]
        channel = 110 + index * 28
        y = min(source["y"], target["y"]) - channel
        points = (
            f'<mxPoint x="{source["x"] + source["width"] // 2}" y="{y}"/>'
            f'<mxPoint x="{target["x"] + target["width"] // 2}" y="{y}"/>'
        )
        cells.append(
            f'<mxCell id="e{index}" value="{_attr(edge.get("label", ""))}" style="{EDGE}" edge="1" parent="1" '
            f'source="{_attr(edge["source"])}" target="{_attr(edge["target"])}">'
            f'<mxGeometry relative="1" as="geometry"><Array as="points">{points}</Array></mxGeometry></mxCell>'
        )
    page_w = x + 40
    page_h = 80 + max(box["height"] for box in boxes.values()) + 80
    body = "".join(cells)
    return (
        '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="object">'
        f'<mxGraphModel pageWidth="{page_w}" pageHeight="{page_h}"><root>{body}</root></mxGraphModel>'
        "</diagram></mxfile>"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(render(json.loads(args.input.read_text(encoding="utf-8"))), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
