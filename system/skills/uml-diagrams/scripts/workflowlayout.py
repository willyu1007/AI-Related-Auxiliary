#!/usr/bin/env python3
"""从流程图内容 JSON 生成 draw.io。框按文字收紧，开始/结束为文字扁圆。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

FONT = 18


def _attr(value: object) -> str:
    return escape(str(value), {'"': "&quot;", "\n": "&#xa;"})


def _visual_length(text: str) -> int:
    return sum(2 if ord(char) > 0x7F else 1 for char in text)


def _box(label: str, kind: str) -> tuple[int, int]:
    lines = [line for line in str(label).split("\n") if line] or [""]
    longest = max(_visual_length(line) for line in lines)
    width = max(120, 28 + longest * (FONT // 2 + 1))
    height = 20 + len(lines) * (FONT + 10)
    if kind == "decision":
        return int(width * 1.35), int(height * 1.45)
    if kind in {"start", "end", "terminator"}:
        return max(140, width), 52
    return width, height


def render(graph: dict) -> str:
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    if not nodes:
        raise ValueError("workflow graph has no nodes")
    placed = []
    y = 40
    widths = []
    for node in nodes:
        kind = node.get("kind", "process")
        label = node.get("label", node["id"])
        width, height = _box(label, kind)
        placed.append({**node, "kind": kind, "label": label, "width": width, "height": height, "y": y})
        widths.append(width)
        y += height + 36
    page_w = max(widths) + 160
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    boxes = {}
    for node in placed:
        x = (page_w - node["width"]) // 2
        kind = node["kind"]
        if kind in {"start", "end", "terminator"}:
            style = (
                f"rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#ffffff;strokeColor=#333333;"
                f"strokeWidth=2;fontFamily=Microsoft YaHei;fontSize={FONT};"
            )
        elif kind == "decision":
            style = (
                f"rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#355E8D;"
                f"strokeWidth=2;fontFamily=Microsoft YaHei;fontSize={FONT};"
            )
        else:
            style = (
                f"rounded=1;whiteSpace=wrap;html=1;arcSize=12;fillColor=#ffffff;strokeColor=#355E8D;"
                f"strokeWidth=2;fontFamily=Microsoft YaHei;fontSize={FONT};spacing=8;"
            )
        boxes[node["id"]] = {"x": x, "y": node["y"], "width": node["width"], "height": node["height"]}
        cells.append(
            f'<mxCell id="{_attr(node["id"])}" value="{_attr(node["label"])}" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{node["y"]}" width="{node["width"]}" height="{node["height"]}" as="geometry"/>'
            "</mxCell>"
        )
    leaving: dict[str, int] = {}
    counts: dict[str, int] = {}
    for edge in edges:
        counts[edge["source"]] = counts.get(edge["source"], 0) + 1
    for index, edge in enumerate(edges):
        slot = leaving.get(edge["source"], 0)
        leaving[edge["source"]] = slot + 1
        total = counts[edge["source"]]
        exit_x = (slot + 1) / (total + 1)
        source = boxes[edge["source"]]
        target = boxes[edge["target"]]
        channel = source["y"] + source["height"] + 12 + slot * 14
        points = (
            f'<mxPoint x="{source["x"] + int(source["width"] * exit_x)}" y="{channel}"/>'
            f'<mxPoint x="{target["x"] + target["width"] // 2}" y="{channel}"/>'
        )
        style = (
            "edgeStyle=orthogonalEdgeStyle;html=1;endArrow=block;endFill=1;strokeWidth=2;"
            f"strokeColor=#333333;fontSize=14;labelBackgroundColor=#ffffff;exitX={exit_x:.3f};exitY=1;entryX=0.5;entryY=0;"
        )
        cells.append(
            f'<mxCell id="e{index}" value="{_attr(edge.get("label", ""))}" style="{style}" edge="1" parent="1" '
            f'source="{_attr(edge["source"])}" target="{_attr(edge["target"])}">'
            f'<mxGeometry relative="1" as="geometry"><Array as="points">{points}</Array></mxGeometry></mxCell>'
        )
    body = "".join(cells)
    return (
        '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="workflow">'
        f'<mxGraphModel pageWidth="{page_w}" pageHeight="{y + 20}"><root>{body}</root></mxGraphModel>'
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
