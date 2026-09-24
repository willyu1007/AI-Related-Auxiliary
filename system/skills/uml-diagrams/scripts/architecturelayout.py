#!/usr/bin/env python3
"""从结构/部署内容 JSON 生成 draw.io。层间留出间隙，查询与响应分道。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

LAYER_H = 150
LAYER_GAP = 70
NODE_W = 150
NODE_H = 56
LAYER = "rounded=0;fillColor=none;strokeColor=#355E8D;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=8;fontStyle=1;fontSize=14;"
NODE = "rounded=1;whiteSpace=wrap;html=1;strokeWidth=2;strokeColor=#355E8D;fillColor=#ffffff;fontSize=14;"
EDGE = "edgeStyle=orthogonalEdgeStyle;html=1;endArrow=block;endFill=1;strokeWidth=2;strokeColor=#333333;labelBackgroundColor=#ffffff;"
RESPONSE = EDGE + "dashed=1;"


def _attr(value: object) -> str:
    return escape(str(value), {'"': "&quot;", "\n": "&#xa;"})


def render(graph: dict) -> str:
    layers = graph.get("layers", [])
    if not layers:
        raise ValueError("architecture graph has no layers")
    boxes: dict[str, dict] = {}
    layer_box: dict[str, dict] = {}
    max_nodes = max(len(layer.get("nodes", [])) for layer in layers)
    content_w = 80 + max(1, max_nodes) * (NODE_W + 40) + 40
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for index, layer in enumerate(layers):
        y = 40 + index * (LAYER_H + LAYER_GAP)
        layer_box[layer["id"]] = {"y": y, "bottom": y + LAYER_H}
        cells.append(
            f'<mxCell id="layer_{_attr(layer["id"])}" value="{_attr(layer.get("label", layer["id"]))}" style="{LAYER}" vertex="1" parent="1">'
            f'<mxGeometry x="40" y="{y}" width="{content_w - 40}" height="{LAYER_H}" as="geometry"/></mxCell>'
        )
        for node_index, node in enumerate(layer.get("nodes", [])):
            x = 80 + node_index * (NODE_W + 40)
            node_y = y + 48
            boxes[node["id"]] = {"x": x, "y": node_y, "layer": layer["id"]}
            cells.append(
                f'<mxCell id="{_attr(node["id"])}" value="{_attr(node.get("label", node["id"]))}" style="{NODE}" vertex="1" parent="1">'
                f'<mxGeometry x="{x}" y="{node_y}" width="{NODE_W}" height="{NODE_H}" as="geometry"/></mxCell>'
            )
    query_slot = 0
    response_slot = 0
    for index, edge in enumerate(graph.get("edges", [])):
        source = boxes[edge["source"]]
        target = boxes[edge["target"]]
        kind = edge.get("kind", "flow")
        sx = source["x"] + NODE_W // 2
        tx = target["x"] + NODE_W // 2
        sy = source["y"] + NODE_H // 2
        ty = target["y"] + NODE_H // 2
        style = RESPONSE if kind == "response" else EDGE
        if kind == "query":
            source_layer = layer_box[source["layer"]]
            target_layer = layer_box[target["layer"]]
            upper = min(source_layer["bottom"], target_layer["bottom"])
            lower = max(source_layer["y"], target_layer["y"])
            gap_y = upper + (lower - upper) // 2 + query_slot * 16
            query_slot += 1
            points = f'<mxPoint x="24" y="{sy}"/><mxPoint x="24" y="{gap_y}"/><mxPoint x="{tx}" y="{gap_y}"/>'
        elif kind == "response":
            lower = max(layer_box[source["layer"]]["bottom"], layer_box[target["layer"]]["bottom"])
            channel = lower + 24 + response_slot * 16
            response_slot += 1
            points = f'<mxPoint x="{sx}" y="{channel}"/><mxPoint x="{tx}" y="{channel}"/>'
        else:
            channel = min(sy, ty) - 24 - index * 12
            points = f'<mxPoint x="{sx}" y="{channel}"/><mxPoint x="{tx}" y="{channel}"/>'
        cells.append(
            f'<mxCell id="e{index}" value="{_attr(edge.get("label", ""))}" style="{style}" edge="1" parent="1" '
            f'source="{_attr(edge["source"])}" target="{_attr(edge["target"])}">'
            f'<mxGeometry relative="1" as="geometry"><Array as="points">{points}</Array></mxGeometry></mxCell>'
        )
    page_h = 40 + len(layers) * (LAYER_H + LAYER_GAP) + 40
    body = "".join(cells)
    return (
        '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="architecture">'
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
