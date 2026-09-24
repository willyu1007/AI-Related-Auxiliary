#!/usr/bin/env python3
"""从活动图内容 JSON 生成 draw.io。泳道按角色分层，分叉与汇合使用独立通道。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

LANE_H = 120
ACTION = "rounded=1;whiteSpace=wrap;html=1;arcSize=12;strokeWidth=2;strokeColor=#355E8D;fillColor=#ffffff;fontSize=14;"
DECISION = "rhombus;whiteSpace=wrap;html=1;strokeWidth=2;strokeColor=#355E8D;fillColor=#ffffff;fontSize=14;"
BAR = "rounded=0;html=1;fillColor=#333333;strokeColor=#333333;strokeWidth=2;"
INITIAL = "ellipse;html=1;fillColor=#333333;strokeColor=#333333;strokeWidth=2;"
FINAL = "ellipse;html=1;fillColor=#ffffff;strokeColor=#333333;strokeWidth=4;"
LANE = "rounded=0;fillColor=none;strokeColor=#355E8D;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=8;fontSize=14;fontStyle=1;"
EDGE = "edgeStyle=orthogonalEdgeStyle;html=1;endArrow=block;endFill=1;strokeWidth=2;strokeColor=#333333;labelBackgroundColor=#ffffff;"


def _attr(value: object) -> str:
    return escape(str(value), {'"': "&quot;", "\n": "&#xa;"})


def _size(kind: str) -> tuple[int, int]:
    if kind in {"initial", "final"}:
        return 28, 28
    if kind in {"fork", "join"}:
        return 120, 10
    if kind == "decision":
        return 120, 70
    return 140, 52


def render(graph: dict) -> str:
    lanes = graph.get("lanes") or [{"id": "main", "label": ""}]
    lane_index = {lane["id"]: index for index, lane in enumerate(lanes)}
    nodes = graph.get("nodes", [])
    if not nodes:
        raise ValueError("activity graph has no nodes")
    boxes: dict[str, dict] = {}
    for index, node in enumerate(nodes):
        kind = node.get("kind", "action")
        width, height = _size(kind)
        lane = lane_index[node.get("lane", lanes[0]["id"])]
        x = 150 + index * 180
        y = 48 + lane * LANE_H + (LANE_H - height) // 2
        boxes[node["id"]] = {"x": x, "y": y, "width": width, "height": height, "kind": kind, "lane": lane, "label": node.get("label", "")}
    content_w = max(box["x"] + box["width"] for box in boxes.values()) + 80
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for index, lane in enumerate(lanes):
        cells.append(
            f'<mxCell id="lane_{_attr(lane["id"])}" value="{_attr(lane.get("label", ""))}" style="{LANE}" vertex="1" parent="1">'
            f'<mxGeometry x="40" y="{40 + index * LANE_H}" width="{content_w - 40}" height="{LANE_H - 8}" as="geometry"/></mxCell>'
        )
    for node_id, box in boxes.items():
        style = {"initial": INITIAL, "final": FINAL, "fork": BAR, "join": BAR, "decision": DECISION}.get(box["kind"], ACTION)
        cells.append(
            f'<mxCell id="{_attr(node_id)}" value="{_attr(box["label"])}" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{box["x"]}" y="{box["y"]}" width="{box["width"]}" height="{box["height"]}" as="geometry"/></mxCell>'
        )
    leaving: dict[str, int] = {}
    for index, edge in enumerate(graph.get("edges", [])):
        source = boxes[edge["source"]]
        target = boxes[edge["target"]]
        slot = leaving.get(edge["source"], 0)
        leaving[edge["source"]] = slot + 1
        if source["lane"] == target["lane"]:
            channel = source["y"] + source["height"] + 16 + slot * 16
        else:
            boundary = 40 + min(source["lane"], target["lane"]) * LANE_H + LANE_H - 4
            channel = boundary + slot * 14
        sx = source["x"] + source["width"] // 2
        tx = target["x"] + target["width"] // 2
        points = f'<mxPoint x="{sx}" y="{channel}"/><mxPoint x="{tx}" y="{channel}"/>'
        cells.append(
            f'<mxCell id="e{index}" value="{_attr(edge.get("label", ""))}" style="{EDGE}" edge="1" parent="1" '
            f'source="{_attr(edge["source"])}" target="{_attr(edge["target"])}">'
            f'<mxGeometry relative="1" as="geometry"><Array as="points">{points}</Array></mxGeometry></mxCell>'
        )
    page_h = 40 + len(lanes) * LANE_H + 40
    body = "".join(cells)
    return (
        '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="activity">'
        f'<mxGraphModel pageWidth="{content_w + 40}" pageHeight="{page_h}"><root>{body}</root></mxGraphModel>'
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
