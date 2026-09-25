---
name: uml-diagrams-new
description: 基于官方 draw.io Skill 生成 UML/流程图/状态机/类图等。Mermaid 语义源 + 按图类型 references；贴 Word 时读该类型 md 的「贴进文档」节。
---

# UML 图生成（新）

本技能是 [jgraph/drawio-mcp](https://github.com/jgraph/drawio-mcp) 官方 draw.io Skill 的**扩展包**。CLI 流水线以 `upstream/SKILL.md` 为准。

## 三层与修改边界

| 层 | 产物 | 允许做什么 |
|----|------|------------|
| **语义** | `.mmd` | 文案、条件标签、可见性符号、**小幅**结构调整（改 id 不影响拓扑、补一条遗漏边、汇合到已有节点） |
| **布局** | `.mmd` 拓扑 + `layouts/*.json` + Ungroup 后 ELK | **拆图**、**折返双列**、**增删节点/步骤**、**合并/压缩步骤**、`subgraph` 分栏、换 preset、调间距 |
| **转换后** | Ungroup 后的 `.drawio` / MCP | 端口、边标签 offset、线型/圆角、生命线、样式批量检查 |

**回退规则**

- 语义层**只能**做稍小的结构调整；一旦涉及 **拆图、增删元素、较大布局调整**（含折返双列、改主链顺序、为贴 Word 改拓扑），**不得**在「转换后」或「贴进文档」阶段硬改——**回退到布局步骤**：先改 `.mmd`（及必要时 preset），重新 CLI 转换 → Ungroup → 再进转换后。
- 已在转换后/贴文档 QA 中发现需上述改动时，同样回退布局，不要仅用 MCP 挪框、藏节点或手拉折返线凑版心。

## 执行顺序

1. **必读** `upstream/SKILL.md`
2. **只读**与当前图类对应的 `references/<类型>.md`（含语义、布局、样式、转换后、贴进文档）
3. **语义**：写/改 `media/<basename>.mmd`（遵守上表边界）
4. CLI：`drawio -x -f xml -o <basename>.drawio <basename>.mmd`
5. **布局**：Ungroup → 间距/平行边用文档「布局」中的 preset；拓扑类调整回到步骤 3
6. **转换后**：按该文档「转换后」「样式」微调（端口、标签、线型）
7. 用户明确贴 Word/PDF → 执行该文档 **「贴进文档（可选）」** 节；若需拆图/折返/增删框 → **回步骤 3–5**

禁止手算坐标。

## 按图类型（唯一参考入口）

| 图类 | 文档 | 布局 preset |
|------|------|-------------|
| 流程图 | [references/flowchart.md](references/flowchart.md) | `layouts/flowchart-default.json` |
| 类图 | [references/class-diagram.md](references/class-diagram.md) | `layouts/class-default.json` |
| 时序图 | [references/sequence-diagram.md](references/sequence-diagram.md) | — |
| 状态机 | [references/state-machine.md](references/state-machine.md) | — |
| 结构/组件 | [references/structure.md](references/structure.md) | `layouts/structure-default.json`、`layouts/graph-horizontal.json` |

示例：`examples/fig-control-flow.mmd`。

## 工具分工

| 工具 | 职责 |
|------|------|
| draw.io CLI | Mermaid→drawio、ELK `--layout`、导出 |
| user-drawio MCP | Ungroup 后的端口、标签、生命线 |

辅助脚本：`scripts/find-drawio.ps1`、`scripts/render-diagram.ps1`。
