---
name: uml-diagrams-new
description: 基于官方 draw.io Skill 生成 UML/流程图/状态机/类图等。默认 Mermaid 语义源 + draw.io CLI；ELK 布局用 layouts/*.json；贴 Word 时启用 doc-export。稳定后将取代 uml-diagrams。
---

# UML 图生成（新）

本技能是 [jgraph/drawio-mcp](https://github.com/jgraph/drawio-mcp) 官方 draw.io Skill 的**扩展包**。CLI 流水线、Mermaid 转换、ELK `--layout` 规则以 `upstream/SKILL.md` 为准；本文件只写增量。

旧版 `system/skills/uml-diagrams/` 保留作参考，稳定后删除并重命名本目录为 `uml-diagrams`。

## 执行顺序

1. **必读** `upstream/SKILL.md`（vendored，upstream 版本见 `upstream/NOTICE`）
2. 写/改语义源：`media/<basename>.mmd`（Mermaid）
3. 定位 draw.io CLI（Windows 见 upstream 中 `find-drawio.ps1` 一节）
4. 转换：`drawio -x -f xml -o <basename>.drawio <basename>.mmd`
5. 布局不满意且输入为 XML 时，才用 `layouts/*.json` 二次 `--layout`（Mermaid 一步转换后通常不再 layout）
6. 用户明确要 PNG/SVG 或贴进 Word 时再导出
7. ELK/layout.json 仍有盲区时，用 draw.io 桌面或 `user-drawio` MCP **微调**；禁止用 MCP 替代 CLI 做首次布局

## 语义源

| 图类 | Mermaid 类型 | 示例 |
|------|-------------|------|
| 流程图 | `flowchart TD` | `examples/fig-control-flow.mmd` |
| 状态机 | `stateDiagram-v2` | 见 `references/domain-conventions.md` |
| 类图 | `classDiagram` | |
| 时序图 | `sequenceDiagram` | |
| 结构/组件 | `flowchart` + `subgraph` | `layouts/structure-default.json` |

禁止手算节点坐标。禁止恢复 `row`/`column`/`route`/`merge` 布局字段。

## 布局预设

自旧版 layout 脚本提取的 ELK 偏好，路径相对于本技能目录：

| 文件 | 用途 | 来源常量 |
|------|------|----------|
| `layouts/flowchart-default.json` | 竖向流程图 | ROW_GAP 48, COL_GAP 80 |
| `layouts/structure-default.json` | 分层结构图 | TIER_GAP 100, COL_GAP 40 |
| `layouts/graph-horizontal.json` | 横向关系图 | autolayout LR |

```powershell
$drawio = & powershell -NoProfile -File scripts/find-drawio.ps1
& $drawio -x -f xml --layout layouts/flowchart-default.json -o out.drawio in.drawio
```

完整 JSON 格式：[draw.io JSON layout specification](https://www.drawio.com/docs/reference/json-layout-specification/)

## 可选：贴进 Word / 说明书（export: docx）

**仅当用户明确图将嵌入 Word、PDF 说明书或其他文档时**，额外阅读并执行 `references/doc-export.md`。

未声明贴文档时：不强制画布宽度、裁剪倍率；交付 `.drawio` 或普通预览 PNG 即可。

## 领域约定

中文雷达/仿真类说明书额外规则见 `references/domain-conventions.md`。

## 默认样式

单色工程图偏好见 `references/style-default.md`。可在 Mermaid 中用 `classDef`，或在 `.drawio` 导出前批量改 style；贴文档时与 doc-export 一并检查。

## 与 MCP 分工

| 工具 | 职责 |
|------|------|
| draw.io CLI | Mermaid→drawio、ELK layout、PNG/SVG 导出 |
| user-drawio MCP | 打开已有 drawio、局部改线/改标签 |
| 旧版 Python layout 脚本 | **勿用**（已弃用） |
