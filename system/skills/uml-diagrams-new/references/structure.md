# 结构 / 组件图

- Mermaid：`flowchart TD` + `subgraph`（分层）；横向关系用 `flowchart LR`
- 布局 preset：[structure-default.json](../layouts/structure-default.json)、[graph-horizontal.json](../layouts/graph-horizontal.json)

## 语义

> 修改边界见 [SKILL.md](../SKILL.md)「三层与修改边界」：本节改组件名/层标签；**增删模块、改 subgraph 结构、拆层/拆图**回布局层改 `.mmd` 并重跑转换。

- 每层/模块一个 `subgraph`，内部放组件节点
- 层间、跨模块边在 Mermaid 中显式声明
- 一步一组件；标签与文档语言一致

### 横向关系

无明确分层、模块间横向依赖：`flowchart LR` + `graph-horizontal.json`。

## 布局

- 竖向分层：Ungroup 后 `structure-default.json`
- 横向：`graph-horizontal.json`
- 画布过宽（>1200 px）且需贴文档时：**优先改图**（减列、拆层、合并模块）

## 样式

| 项 | 值 |
|----|-----|
| 填充 / 框线 / 连线 | `#ffffff` / `#333333`，`strokeWidth=2` |
| 文字 | `#000000`，Microsoft YaHei，`fontSize≥14` |
| 边 | `orthogonalEdgeStyle;rounded=0;endArrow=block;endFill=1` |
| subgraph 框 | 可 `strokeWidth=2`，无彩色填充 |

## 转换后

- 跨层长横线穿框：加 waypoint 或 MCP 绕行
- 双向边分通道（上/下或实/虚）

## 贴进文档（可选）

**仅当用户明确图将嵌入 Word/PDF 等时执行本节。**

### 导出

```powershell
$drawio = & powershell -NoProfile -File scripts/find-drawio.ps1
& $drawio -x -f png -e -b 10 -s 3 --crop -o name.drawio.png name.drawio
```

画布宽度 **700–1200 px**（结构图勿无谓撑到 2000+）。过宽时**改图**收列/拆层，勿仅依赖 Word 缩放。

### 贴文档前 QA

1. 线宽在 Word 满宽下仍可见
2. 无穿框长横线、双向边不叠压
3. Word 显示尺寸下字可读
