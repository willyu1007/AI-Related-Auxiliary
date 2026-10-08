# 布局预设（draw.io）

本目录是**转换后的明确布局修复**，不是 Mermaid 生成配置。JSON 格式与 [draw.io 规范](https://www.drawio.com/docs/reference/json-layout-specification/) 一致。
默认生成使用 `../generation/<类型>.json`，在 Mermaid→draw.io 时请求布局，不追加第二次布局。只有确需修复现有图才使用本目录；Ungroup 仅在实际组合妨碍操作时使用。时序 preset 不改变参与者顺序或生命线。

| 文件 | 图类 | 说明 |
|------|------|------|
| [flowchart-default.json](flowchart-default.json) | 流程图 | 竖向 layered + 平行边分开；层间距 48、同层 80 |
| [class-default.json](class-default.json) | 类图 | 加大 nodeNode / 层间距，缓解关联线过短 |
| [structure-default.json](structure-default.json) | 结构/组件 | 竖向分层；层间距 100、同层 40 |
| [graph-horizontal.json](graph-horizontal.json) | 横向关系 | `elk.direction: RIGHT` |
| [sequence-default.json](sequence-default.json) | 时序图 | 只分开重叠的平行消息边；不重排参与者与生命线 |
| [state-machine-default.json](state-machine-default.json) | 状态机 | 自上而下分层，正交连线，并分开平行边 |

## 用法

```powershell
$drawio = & powershell -NoProfile -File ../scripts/find-drawio.ps1
& $drawio -x -f xml --layout flowchart-default.json -o out.drawio in.drawio
```

路径相对于本目录，或在 SKILL 根目录用 `layouts/flowchart-default.json`。

## 与各类型文档的关系

每种图的规则在 `references/<类型>.md`；最终尺寸和几何闭环见 `../references/size-and-geometry.md`。修复后重新应用样式、导出 SVG、运行检测。
