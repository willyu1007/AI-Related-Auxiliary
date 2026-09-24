#!/usr/bin/env python3
"""从用例图内容 JSON 生成 draw.io。Actor 在系统边界外，用例在边界内。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

ACTOR = "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;strokeWidth=2;strokeColor=#333333;"
CASE = "ellipse;whiteSpace=wrap;html=1;strokeWidth=2;strokeColor=#355E8D;fillColor=#ffffff;fontSize=14;"
BOUNDARY = "rounded=0;dashed=0;fillColor=none;strokeColor=#355E8D;strokeWidth=2;verticalAlign=top;fontSize=14;fontStyle=1;"
ASSOC = "html=1;endArrow=none;strokeWidth=2;strokeColor=#333333;labelBackgroundColor=#ffffff;"
STEREOTYPE = "html=1;endArrow=open;dashed=1;strokeWidth=2;strokeColor=#333333;labelBackgroundColor=#ffffff;"


def _attr(value: object) -> str:
    return escape(str(value), {'"': "&quot;", "\n": "&#xa;"})


def render(graph: dict) -> str:
    actors = graph.get("actors", [])
    cases = graph.get("usecases", [])
    if not cases:
        raise ValueError("use case graph has no usecases")
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    case_h = 64
    boundary_h = 40 + len(cases) * (case_h + 28)
    boundary_w = 280
    cells.append(
        f'<mxCell id="boundary" value="{_attr(graph.get("system", "系统"))}" style="{BOUNDARY}" vertex="1" parent="1">'
        f'<mxGeometry x="220" y="40" width="{boundary_w}" height="{boundary_h}" as="geometry"/></mxCell>'
    )
    span = max(boundary_h - 80, 1)
    for index, actor in enumerate(actors):
        y = 80 + (0 if len(actors) == 1 else int(index * span / (len(actors) - 1)))
        cells.append(
            f'<mxCell id="{_attr(actor["id"])}" value="{_attr(actor.get("label", actor["id"]))}" style="{ACTOR}" vertex="1" parent="1">'
            f'<mxGeometry x="60" y="{y}" width="40" height="70" as="geometry"/></mxCell>'
        )
    for index, case in enumerate(cases):
        y = 80 + index * (case_h + 28)
        cells.append(
            f'<mxCell id="{_attr(case["id"])}" value="{_attr(case.get("label", case["id"]))}" style="{CASE}" vertex="1" parent="1">'
            f'<mxGeometry x="270" y="{y}" width="180" height="{case_h}" as="geometry"/></mxCell>'
        )
    for index, edge in enumerate(graph.get("edges", [])):
        kind = edge.get("kind", "association")
        style = STEREOTYPE if kind in {"include", "extend"} else ASSOC
        label = edge.get("label") or ("«include»" if kind == "include" else "«extend»" if kind == "extend" else "")
        cells.append(
            f'<mxCell id="e{index}" value="{_attr(label)}" style="{style}" edge="1" parent="1" '
            f'source="{_attr(edge["source"])}" target="{_attr(edge["target"])}">'
            '<mxGeometry relative="1" as="geometry"/></mxCell>'
        )
    body = "".join(cells)
    page_h = 80 + boundary_h
    return (
        '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="usecase">'
        f'<mxGraphModel pageWidth="560" pageHeight="{page_h}"><root>{body}</root></mxGraphModel>'
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
