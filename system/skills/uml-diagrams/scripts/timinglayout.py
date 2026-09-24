#!/usr/bin/env python3
"""从时间图内容 JSON 生成 draw.io。各生命线共用时间刻度，状态变化走垂直阶梯。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

TICK_W = 90
ROW_H = 80
LEFT = 150
LINE = "endArrow=none;html=1;strokeWidth=2;strokeColor=#333333;rounded=0;"
GRID = "endArrow=none;html=1;strokeWidth=1;strokeColor=#355E8D;dashed=1;"
LABEL = "text;html=1;strokeColor=none;fillColor=none;align=right;fontSize=14;"
TICK = "text;html=1;strokeColor=none;fillColor=none;align=center;fontSize=13;"


def _attr(value: object) -> str:
    return escape(str(value), {'"': "&quot;"})


def render(graph: dict) -> str:
    ticks = [str(item) for item in graph.get("ticks", [])]
    lifelines = graph.get("lifelines", [])
    if not ticks or not lifelines:
        raise ValueError("timing graph requires ticks and lifelines")
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    width = LEFT + len(ticks) * TICK_W + 40
    for index, tick in enumerate(ticks):
        x = LEFT + index * TICK_W
        cells.append(
            f'<mxCell id="tick_{index}" value="{_attr(tick)}" style="{TICK}" vertex="1" parent="1">'
            f'<mxGeometry x="{x - 30}" y="24" width="60" height="24" as="geometry"/></mxCell>'
        )
        cells.append(
            f'<mxCell id="grid_{index}" style="{GRID}" edge="1" parent="1">'
            f'<mxGeometry relative="0" as="geometry">'
            f'<mxPoint x="{x}" y="56" as="sourcePoint"/>'
            f'<mxPoint x="{x}" y="{56 + len(lifelines) * ROW_H}" as="targetPoint"/>'
            "</mxGeometry></mxCell>"
        )
    for row, lifeline in enumerate(lifelines):
        states = [str(item) for item in lifeline.get("states", [])]
        if len(states) != len(ticks):
            raise ValueError(f"{lifeline.get('id', row)} states must match ticks")
        top = 70 + row * ROW_H
        levels = list(dict.fromkeys(states))
        step = 28 if len(levels) > 1 else 0

        def state_y(state: str) -> int:
            return top + 16 + levels.index(state) * step

        cells.append(
            f'<mxCell id="label_{row}" value="{_attr(lifeline.get("label", lifeline.get("id", row)))}" style="{LABEL}" vertex="1" parent="1">'
            f'<mxGeometry x="16" y="{top}" width="120" height="28" as="geometry"/></mxCell>'
        )
        points = []
        for index, state in enumerate(states):
            x = LEFT + index * TICK_W
            y = state_y(state)
            if points and points[-1][1] != y:
                points.append((x, points[-1][1]))
            points.append((x, y))
            points.append((x + TICK_W, y))
        source = points[0]
        target = points[-1]
        bends = "".join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in points[1:-1])
        cells.append(
            f'<mxCell id="wave_{row}" style="{LINE}" edge="1" parent="1">'
            f'<mxGeometry relative="0" as="geometry">'
            f'<mxPoint x="{source[0]}" y="{source[1]}" as="sourcePoint"/>'
            f'<mxPoint x="{target[0]}" y="{target[1]}" as="targetPoint"/>'
            f'<Array as="points">{bends}</Array></mxGeometry></mxCell>'
        )
    page_h = 80 + len(lifelines) * ROW_H
    body = "".join(cells)
    return (
        '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="timing">'
        f'<mxGraphModel pageWidth="{width}" pageHeight="{page_h}"><root>{body}</root></mxGraphModel>'
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
