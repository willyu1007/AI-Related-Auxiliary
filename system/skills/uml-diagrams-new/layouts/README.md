# 布局预设（ELK）

JSON 格式与 [draw.io 规范](https://www.drawio.com/docs/reference/json-layout-specification/) 一致。  
**前提**：已对 Mermaid 容器 **Ungroup**，且仅需调间距/平行边，而非改菱形端口或生命线。

| 文件 | 图类 | 说明 |
|------|------|------|
| [flowchart-default.json](flowchart-default.json) | 流程图 | 竖向 layered + 平行边分开；层间距 48、同层 80 |
| [class-default.json](class-default.json) | 类图 | 加大 nodeNode / 层间距，缓解关联线过短 |
| [structure-default.json](structure-default.json) | 结构/组件 | 竖向分层；层间距 100、同层 40 |
| [graph-horizontal.json](graph-horizontal.json) | 横向关系 | `elk.direction: RIGHT` |

## 用法

```powershell
$drawio = & powershell -NoProfile -File ../scripts/find-drawio.ps1
& $drawio -x -f xml --layout flowchart-default.json -o out.drawio in.drawio
```

路径相对于本目录，或在 SKILL 根目录用 `layouts/flowchart-default.json`。

## 与各类型文档的关系

每种图的全部规则（含语义、样式、贴进文档）在 `references/<类型>.md` 单文件内；本目录仅放 ELK preset JSON。
