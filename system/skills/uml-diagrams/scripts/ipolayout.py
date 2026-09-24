#!/usr/bin/env python3
"""从 IPO 内容 JSON 生成 draw.io。输入、处理、输出各是独立的单项节点。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

FONT = 16
BOX = (
    f"rounded=1;whiteSpace=wrap;html=1;arcSize=12;fillColor=#ffffff;strokeColor=#355E8D;"
    f"strokeWidth=2;fontFamily=Microsoft YaHei;fontSize={FONT};"
)
HEAD = (
    "text;html=1;strokeColor=none;fillColor=none;align=center;fontStyle=1;"
    "fontFamily=Microsoft YaHei;fontSize=16;"
)
EDGE = (
    "edgeStyle=orthogonalEdgeStyle;html=1;endArrow=block;endFill=1;strokeWidth=2;"
    "strokeColor=#333333;labelBackgroundColor=#ffffff;"
)


def _attr(value: object) -> str:
    return escape(str(value), {'"': "&quot;"})


def _items(value: object) -> list[str]:
    if isinstance(value, str):
        return [line.strip() for line in value.split("\n") if line.strip()]
    return [str(item.get("label", item) if isinstance(item, dict) else item) for item in value or []]


def render(graph: dict) -> str:
    columns = (
        ("inputs", "输入"),
        ("steps", "处理"),
        ("outputs", "输出"),
    )
    parsed = [(key, title, _items(graph.get(key, []))) for key, title in columns]
    if any(len(items) == 0 for _, _, items in parsed):
        raise ValueError("IPO graph requires inputs, steps, and outputs")
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    column_boxes: list[list[str]] = []
    for column, (key, title, items) in enumerate(parsed):
        x = 40 + column * 240
        cells.append(
            f'<mxCell id="head_{key}" value="{_attr(title)}" style="{HEAD}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="24" width="180" height="28" as="geometry"/></mxCell>'
        )
        ids = []
        for index, label in enumerate(items):
            node_id = f"{key}_{index}"
            ids.append(node_id)
            y = 68 + index * 72
            cells.append(
                f'<mxCell id="{node_id}" value="{_attr(label)}" style="{BOX}" vertex="1" parent="1">'
                f'<mxGeometry x="{x}" y="{y}" width="180" height="52" as="geometry"/></mxCell>'
            )
        column_boxes.append(ids)
    for column, ids in enumerate(column_boxes[:-1]):
        nxt = column_boxes[column + 1]
        for index, node_id in enumerate(ids):
            target = nxt[min(index, len(nxt) - 1)]
            exit_y = (index + 1) / (len(ids) + 1)
            cells.append(
                f'<mxCell id="e_{node_id}" style="{EDGE}exitX=1;exitY={exit_y:.3f};entryX=0;entryY=0.5;" edge="1" parent="1" '
                f'source="{node_id}" target="{target}"><mxGeometry relative="1" as="geometry"/></mxCell>'
            )
    height = 100 + max(len(items) for _, _, items in parsed) * 72
    body = "".join(cells)
    return (
        '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="ipo">'
        f'<mxGraphModel pageWidth="760" pageHeight="{height}"><root>{body}</root></mxGraphModel>'
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
