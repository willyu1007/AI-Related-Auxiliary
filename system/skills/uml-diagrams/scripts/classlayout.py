#!/usr/bin/env python3
"""Generate deterministic UML class diagrams from semantic JSON.

Unlike the generic graph layout, this generator preserves the visual grammar
of a UML class diagram: every class is one three-compartment UML class box and
relationships are routed around a left-to-right class topology.

Input JSON uses the common UML graph shape::

    {
      "title": "Lifecycle classes",
      "nodes": [
        {"id": "manager", "label": "LifecycleManager\\n----------\\n...\\n----------\\n..."}
      ],
      "edges": [{"source": "manager", "target": "config", "label": "creates"}]
    }

Usage::

    python classlayout.py input.json -o output.drawio
    python classlayout.py input1.json input2.json --output-dir media
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape


SEPARATOR_RE = re.compile(r"^[-=]{3,}$")
MIN_WIDTH = 260
MAX_WIDTH = 380
LINE_HEIGHT = 24
HEADER_HEIGHT = 42
PADDING = 16
LEFT_X = 80
RIGHT_X = 620
TOP_Y = 80
VERTICAL_GAP = 70

CLASS_STYLE = (
    "swimlane;fontStyle=1;align=center;verticalAlign=top;"
    "childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;"
    "resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;"
    "marginBottom=0;whiteSpace=wrap;html=1;"
    "fillColor=#ffffff;strokeColor=#34495e;fontColor=#1f2933;"
    "fontSize=14;strokeWidth=2;"
)
TEXT_STYLE = (
    "text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;"
    "fontColor=#1f2933;fontSize=14;align=left;verticalAlign=top;"
    "spacingLeft=10;spacingRight=10;spacingTop=8;spacingBottom=8;"
)
SEPARATOR_STYLE = (
    "line;strokeWidth=1;fillColor=none;align=left;verticalAlign=middle;"
    "spacingTop=-1;spacingLeft=3;spacingRight=3;rotatable=0;"
    "labelPosition=right;points=[];portConstraint=eastwest;strokeColor=inherit;"
)
EDGE_STYLE = (
    "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;"
    "jettySize=auto;html=1;strokeColor=#34495e;strokeWidth=2;"
    "endArrow=block;endFill=1;labelBackgroundColor=#ffffff;"
)


def xml_attr(value: object) -> str:
    """Escape text for an XML attribute and preserve line breaks."""

    text = str(value).replace("\r\n", "\n").replace("\r", "\n")
    return escape(text, {"\"": "&quot;", "\n": "&#xa;"})


def visual_length(text: str) -> int:
    """Estimate display width, counting CJK characters as two columns."""

    return sum(2 if ord(char) > 0x7F else 1 for char in text)


def split_members(node: dict) -> tuple[str, list[str], list[str]]:
    """Read a node into class name, attributes, and operations."""

    label = str(node.get("label", node.get("id", "")))
    lines = [line.strip() for line in label.replace("\r\n", "\n").split("\n")]
    while lines and not lines[0]:
        lines.pop(0)
    name = lines[0] if lines else str(node.get("id", "Class"))

    separators = [index for index, line in enumerate(lines[1:], 1) if SEPARATOR_RE.match(line)]
    if len(separators) >= 2:
        first, second = separators[:2]
        attributes = [line for line in lines[1:first] if line]
        operations = [line for line in lines[second + 1:] if line]
    elif len(separators) == 1:
        first = separators[0]
        attributes = [line for line in lines[1:first] if line]
        operations = [line for line in lines[first + 1:] if line]
    else:
        attributes = [str(item) for item in node.get("attributes", [])]
        operations = [str(item) for item in node.get("operations", [])]

    if "attributes" in node:
        attributes = [str(item) for item in node["attributes"]]
    if "operations" in node:
        operations = [str(item) for item in node["operations"]]
    return name, attributes, operations


def class_geometry(name: str, attributes: list[str], operations: list[str]) -> tuple[int, int]:
    """Calculate a readable fixed-size class box."""

    longest = max([visual_length(name)] + [visual_length(item) for item in attributes + operations])
    width = max(MIN_WIDTH, min(MAX_WIDTH, 32 + longest * 8))
    rows = 2 + max(1, len(attributes)) + max(1, len(operations))
    height = HEADER_HEIGHT + rows * LINE_HEIGHT + PADDING
    return width, height


def choose_root(nodes: list[dict], edges: list[dict]) -> str | None:
    """Choose the class that best represents the left-side module anchor."""

    if not nodes:
        return None
    order = {node["id"]: index for index, node in enumerate(nodes)}
    score = {node["id"]: 0 for node in nodes}
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source in score:
            score[source] += 2
        if target in score:
            score[target] -= 1
    return max(score, key=lambda node_id: (score[node_id], -order[node_id]))


def layout(graph: dict) -> tuple[dict[str, dict], dict[str, tuple[str, list[str], list[str]]]]:
    """Place an anchor class on the left and related classes on the right."""

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    root_id = choose_root(nodes, edges)
    parsed = {node["id"]: split_members(node) for node in nodes}
    boxes: dict[str, dict] = {}

    if root_id is None:
        return boxes, parsed

    sizes = {
        node_id: class_geometry(name, attributes, operations)
        for node_id, (name, attributes, operations) in parsed.items()
    }
    dependents = [node for node in nodes if node["id"] != root_id]
    stack_height = sum(sizes[node["id"]][1] for node in dependents)
    stack_height += max(0, len(dependents) - 1) * VERTICAL_GAP
    root_width, root_height = sizes[root_id]
    root_y = max(TOP_Y, TOP_Y + (stack_height - root_height) / 2)
    boxes[root_id] = {"x": LEFT_X, "y": root_y, "width": root_width, "height": root_height}

    y = TOP_Y
    for node in dependents:
        node_id = node["id"]
        width, height = sizes[node_id]
        boxes[node_id] = {"x": RIGHT_X, "y": y, "width": width, "height": height}
        y += height + VERTICAL_GAP
    return boxes, parsed


def edge_geometry(edge: dict, boxes: dict[str, dict], edge_index: int) -> str:
    """Create a small explicit orthogonal route for a relationship edge."""

    source = boxes[edge["source"]]
    target = boxes[edge["target"]]
    source_right = source["x"] + source["width"]
    target_right = target["x"] + target["width"]
    source_left = source["x"]
    target_left = target["x"]
    source_mid = source["y"] + source["height"] / 2
    target_mid = target["y"] + target["height"] / 2

    if source_right <= target_left:
        bus_x = source_right + 70 + edge_index * 24
        points = [(bus_x, source_mid), (bus_x, target_mid)]
    elif target_right <= source_left:
        bus_x = target_right + 70 + edge_index * 24
        points = [(bus_x, source_mid), (bus_x, target_mid)]
    else:
        mid_x = min(source["x"], target["x"]) - 50 - edge_index * 20
        points = [(mid_x, source_mid), (mid_x, target_mid)]

    point_xml = "".join(
        f'<mxPoint x="{int(round(x))}" y="{int(round(y))}"/>' for x, y in points
    )
    return f'<mxGeometry relative="1" as="geometry"><Array as="points">{point_xml}</Array></mxGeometry>'


def page_xml(graph: dict, page_id: str) -> str:
    boxes, parsed = layout(graph)
    if not boxes:
        raise ValueError("class graph has no nodes")

    max_x = max(box["x"] + box["width"] for box in boxes.values()) + 120
    max_y = max(box["y"] + box["height"] for box in boxes.values()) + 100
    cells = []
    for node in graph.get("nodes", []):
        node_id = node["id"]
        if node_id not in boxes:
            continue
        name, attributes, operations = parsed[node_id]
        box = boxes[node_id]
        cells.append(
            f'<mxCell id="{xml_attr(node_id)}" value="{xml_attr(name)}" '
            f'style="{xml_attr(CLASS_STYLE)}" vertex="1" parent="1">'
            f'<mxGeometry x="{int(round(box["x"]))}" y="{int(round(box["y"]))}" '
            f'width="{box["width"]}" height="{box["height"]}" as="geometry"/>'
            "</mxCell>"
        )
        attr_height = max(1, len(attributes)) * LINE_HEIGHT + PADDING
        op_height = max(1, len(operations)) * LINE_HEIGHT + PADDING
        header_height = 26
        attr_y = header_height
        separator_y = attr_y + attr_height
        op_y = separator_y + 1
        separator2_y = op_y + op_height
        for suffix, value, y, height in (
            ("attrs", "\n".join(attributes), attr_y, attr_height),
            ("ops", "\n".join(operations), op_y, op_height),
        ):
            cells.append(
                f'<mxCell id="{xml_attr(node_id + "__" + suffix)}" value="{xml_attr(value)}" '
                f'style="{xml_attr(TEXT_STYLE)}" vertex="1" parent="{xml_attr(node_id)}">'
                f'<mxGeometry x="0" y="{y}" width="{box["width"]}" height="{height}" as="geometry"/>'
                "</mxCell>"
            )
        for suffix, y in (("separator1", separator_y), ("separator2", separator2_y)):
            cells.append(
                f'<mxCell id="{xml_attr(node_id + "__" + suffix)}" value="" '
                f'style="{xml_attr(SEPARATOR_STYLE)}" vertex="1" parent="{xml_attr(node_id)}">'
                f'<mxGeometry x="0" y="{y}" width="{box["width"]}" height="1" as="geometry"/>'
                "</mxCell>"
            )

    for index, edge in enumerate(graph.get("edges", [])):
        source = edge.get("source")
        target = edge.get("target")
        if source not in boxes or target not in boxes:
            raise ValueError(f"edge references unknown class: {source!r} -> {target!r}")
        cells.append(
            f'<mxCell id="edge_{index}" value="{xml_attr(edge.get("label", ""))}" '
            f'style="{xml_attr(EDGE_STYLE)}" edge="1" parent="1" '
            f'source="{xml_attr(source)}" target="{xml_attr(target)}">'
            f"{edge_geometry(edge, boxes, index)}</mxCell>"
        )

    title = graph.get("title", page_id)
    model = (
        f'<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" '
        f'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
        f'pageWidth="{int(max_x)}" pageHeight="{int(max_y)}" math="0" shadow="0">'
        "<root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/>"
        + "".join(cells)
        + "</root></mxGraphModel>"
    )
    return f'<diagram id="{xml_attr(page_id)}" name="{xml_attr(title)}">{model}</diagram>'


def render(graph: dict, page_id: str) -> str:
    return '<?xml version="1.0" encoding="UTF-8"?>\n<mxfile>' + page_xml(graph, page_id) + "</mxfile>\n"


def output_path(input_path: Path, output: Path | None, output_dir: Path | None, multiple: bool) -> Path:
    if output is not None:
        if multiple:
            raise ValueError("-o/--output can only be used with one input")
        return output
    filename = input_path.name
    suffix = ".uml-content.json"
    stem = filename[:-len(suffix)] if filename.endswith(suffix) else input_path.stem
    return (output_dir or input_path.parent) / f"{stem}.drawio"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate dedicated UML class diagrams.")
    parser.add_argument("inputs", nargs="+", type=Path, help="semantic UML class JSON files")
    parser.add_argument("-o", "--output", type=Path, help="output .drawio path for one input")
    parser.add_argument("--output-dir", type=Path, help="output directory for multiple inputs")
    args = parser.parse_args()

    try:
        for input_path in args.inputs:
            with input_path.open(encoding="utf-8") as handle:
                graph = json.load(handle)
            destination = output_path(input_path, args.output, args.output_dir, len(args.inputs) > 1)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(render(graph, input_path.stem), encoding="utf-8")
            print(f"wrote {destination}", file=sys.stderr)
    except (OSError, json.JSONDecodeError, ValueError, KeyError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
