---
name: uml-diagrams-new
description: 基于官方 draw.io Skill 生成 UML/流程图/状态机/类图等。Mermaid 语义源 + 按图类型 references；贴 Word 时读该类型 md 的「贴进文档」节。
---

# UML 图生成（新）

本技能是 [jgraph/drawio-mcp](https://github.com/jgraph/drawio-mcp) 官方 draw.io Skill 的扩展包。通用 CLI 参数以 `upstream/SKILL.md` 为准；本文件和 `references/` 中的本地规则必须同时遵守。

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

1. 读 `upstream/SKILL.md`，再读本图对应的 `references/<类型>.md`。不要跳过类型文档中的样式和转换后检查。
2. 在 `.mmd` 中定义节点、关系和布局方向。不要把语义或拓扑问题留给 draw.io 手工挪框修补。
3. 用 `scripts/render-diagram.ps1` 将 `.mmd` 转成 `.drawio` 并应用本地样式。`-DiagramType` 必须与图类一致。
   ```powershell
   & scripts/render-diagram.ps1 -InputPath <basename>.mmd -DiagramType <flowchart|class|sequence|state-machine|structure>
   ```
4. Mermaid 有容器时先 Ungroup。若需调整间距或平行边，只用类型表指定的 JSON，在 Ungroup 后运行 draw.io CLI 布局；不要对 `.mmd` 或仍含容器的图套布局。
   ```powershell
   $drawio = & scripts/find-drawio.ps1
   & $drawio --disable-gpu -x -f xml --layout layouts/<类型>.json -o <basename>.drawio <basename>.drawio
   & scripts/apply-diagram-style.ps1 -InputPath <basename>.drawio -DiagramType <类型>
   ```
5. 检查并修正箭头方向、箭头端点、端口、标签和画布边界。逐条对照本图类型的检查项；出现断线、反向箭头、遮挡或不符合样式时，修好后再导出。
6. 用户要求插入 Word/PDF 等文档时，读取文档版心宽度和可用页面高度；无法从文件确认时，先询问这两个尺寸。按满版心宽度估算：`H_doc = W_doc × 图的高度 / 图的宽度`。若超过可用高度或字号在实际放置尺寸下不可读，返回第 2 步调整布局后重新导出。画布 `700–1200 px` 指裁切后的 draw.io 画布宽度；标准 PNG `-s 3` 导出后的像素宽度是画布宽度的三倍，不能当成 Word 的实际放置宽度。

禁止手算坐标。布局调整须使用 draw.io 布局或拖动工具；修改后重新目视检查连线方向和端点。

## 通用样式检查

| 元素 | 要求 |
|------|------|
| 背景、节点填充 | 白色 `#ffffff` |
| 节点边框、连线 | 深灰 `#333333`，线宽 `2` |
| 文字 | 黑色 `#000000`，Microsoft YaHei，字号至少 `14` |
| 连线标签 | 白底；不得遮住箭头或节点文字 |
| 箭头 | 箭头头部必须落在目标节点端；方向与语义一致 |

具体图形例外和线型以对应类型文档为准。自动样式处理后仍须看导出预览，尤其检查箭头头部、状态图起止符、时序图生命线和文档实际字号。

## 按图类型（唯一参考入口）

| 图类 | 文档 | 布局 preset |
|------|------|-------------|
| 流程图 | [references/flowchart.md](references/flowchart.md) | `layouts/flowchart-default.json` |
| 类图 | [references/class-diagram.md](references/class-diagram.md) | `layouts/class-default.json` |
| 时序图 | [references/sequence-diagram.md](references/sequence-diagram.md) | `layouts/sequence-default.json` |
| 状态机 | [references/state-machine.md](references/state-machine.md) | `layouts/state-machine-default.json` |
| 结构/组件 | [references/structure.md](references/structure.md) | `layouts/structure-default.json`、`layouts/graph-horizontal.json` |

各类型示例见 `examples/README.md`。提交示例源文件和 `.drawio`；PNG 仅用于本地预览，不纳入 Git。

## 工具分工

| 工具 | 职责 |
|------|------|
| `scripts/render-diagram.ps1` | Mermaid→drawio、选用布局 JSON、应用本地样式、导出预览 |
| `scripts/apply-diagram-style.ps1` | Ungroup 后重新应用本地样式 |
| user-drawio MCP | Ungroup 后的端口、标签、生命线 |

底层使用 draw.io CLI。最终交付的 `.drawio` 和 PNG 应通过肉眼检查；PNG 预览不提交到 Git。
