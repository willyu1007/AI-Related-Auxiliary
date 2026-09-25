#!/usr/bin/env python3
"""把现有流程图 draw.io 迁移为候选 workflow 内容 JSON，不改业务文字。"""
from __future__ import annotations

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path


def migrate(source: Path) -> dict:
    root = ET.fromstring(source.read_text(encoding="utf-8"))
    nodes: list[dict] = []
    edges: list[dict] = []
    for cell in root.iter("mxCell"):
        cell_id = cell.attrib.get("id", "")
        if cell.attrib.get("vertex") == "1" and cell_id not in {"0", "1"}:
            geometry = next(iter(cell.findall("mxGeometry")), None)
            style = cell.attrib.get("style", "")
            label = cell.attrib.get("value", "")
            kind = "process"
            if "rhombus" in style:
                kind = "decision"
            elif label in {"开始", "结束"} or "arcSize=50" in style:
                kind = "start" if label == "开始" else "end" if label == "结束" else "terminator"
            node = {"id": cell_id, "label": label, "kind": kind}
            if geometry is not None:
                for key in ("x", "y", "width", "height"):
                    if key in geometry.attrib:
                        node[key] = float(geometry.attrib[key])
            nodes.append(node)
        elif cell.attrib.get("edge") == "1":
            edge = {
                "source": cell.attrib.get("source", ""),
                "target": cell.attrib.get("target", ""),
            }
            if cell.attrib.get("value", ""):
                edge["label"] = cell.attrib["value"]
            edges.append(edge)
    return {"layout": "workflow", "source": source.name, "nodes": nodes, "edges": edges}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("sources", nargs="+", type=Path)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    for source in args.sources:
        output_dir = args.output_dir or source.parent
        destination = output_dir / f"{source.stem}.uml-content.json"
        destination.write_text(json.dumps(migrate(source), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
