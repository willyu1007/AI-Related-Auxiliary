#!/usr/bin/env python3
"""从状态机内容 JSON 生成 draw.io；开始/结束为文字扁圆，状态为圆角矩形。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from workflowlayout import render


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.input.read_text(encoding="utf-8"))
    graph = {"nodes": [], "edges": source.get("transitions", [])}
    for state in source.get("states", []):
        node = dict(state)
        node["kind"] = node.get("kind", "process")
        graph["nodes"].append(node)
    args.output.write_text(render(graph), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
