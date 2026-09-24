#!/usr/bin/env python3
"""从通信图内容 JSON 生成 draw.io。对象横排，消息按顺序编号并上下分道。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

BOX = (
    "rounded=0;whiteSpace=wrap;html=1;strokeWidth=2;strokeColor=#355E8D;fillColor=#ffffff;"
    "fontSize=14;fontStyle=4;align=center;"
)
EDGE = (
    "edgeStyle=orthogonalEdgeStyle;html=1;endArrow=block;endFill=1;strokeWidth=2;"
    "strokeColor=#333333;labelBackgroundColor=#ffffff;fontSize=13;"
)


def _attr(value: object) -> str:
    return escape(str(value), {'"': "&quot;", "\n": "&#xa;"})


def render(graph: dict) -> str:
    objects = graph.get("objects", [])
    if not objects:
        raise ValueError("communication graph has no objects")
    boxes: dict[str, dict] = {}
    x = 80
    for item in objects:
        label = f"{item.get('name', item['id'])} : {item.get('class', '')}".strip()
        width = max(140, 24 + len(label) * 8)
        boxes[item["id"]] = {"x": x, "y": 160, "width": width, "label": label}
        x += width + 100
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for object_id, box in boxes.items():
        cells.append(
            f'<mxCell id="{_attr(object_id)}" value="{_attr(box["label"])}" style="{BOX}" vertex="1" parent="1">'
            f'<mxGeometry x="{box["x"]}" y="{box["y"]}" width="{box["width"]}" height="48" as="geometry"/></mxCell>'
        )
    for index, message in enumerate(graph.get("messages", [])):
        label = message.get("label") or ""
        if not label[:1].isdigit():
            label = f"{index + 1}: {label}".strip()
        source = boxes[message["from"]]
        target = boxes[message["to"]]
        above = index % 2 == 0
        channel = 120 - index * 22 if above else 240 + index * 22
        if message["from"] == message["to"]:
            points = (
                f'<mxPoint x="{source["x"] + source["width"]}" y="{channel}"/>'
                f'<mxPoint x="{source["x"] + source["width"] + 40}" y="{channel}"/>'
                f'<mxPoint x="{source["x"] + source["width"] + 40}" y="{source["y"]}"/>'
            )
        else:
            points = (
                f'<mxPoint x="{source["x"] + source["width"] // 2}" y="{channel}"/>'
                f'<mxPoint x="{target["x"] + target["width"] // 2}" y="{channel}"/>'
            )
        cells.append(
            f'<mxCell id="m{index}" value="{_attr(label)}" style="{EDGE}" edge="1" parent="1" '
            f'source="{_attr(message["from"])}" target="{_attr(message["to"])}">'
            f'<mxGeometry relative="1" as="geometry"><Array as="points">{points}</Array></mxGeometry></mxCell>'
        )
    page_h = 240 + max(1, len(graph.get("messages", []))) * 22 + 40
    body = "".join(cells)
    return (
        '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="communication">'
        f'<mxGraphModel pageWidth="{x + 40}" pageHeight="{page_h}"><root>{body}</root></mxGraphModel>'
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
