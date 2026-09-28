# 图表示例

每行包含 Mermaid 语义源文件和 draw.io 转换文件。PNG 预览只在本地生成，不提交到 Git。

| 类型 | Mermaid 源文件 | draw.io 文件 |
|------|---------------|--------------|
| 流程图 | [flowchart-order-confirm.mmd](flowchart-order-confirm.mmd) | [flowchart-order-confirm.drawio](preview/flowchart-order-confirm.drawio) |
| 类图 | [class-order-lifecycle.mmd](class-order-lifecycle.mmd) | [class-order-lifecycle.drawio](preview/class-order-lifecycle.drawio) |
| 时序图 | [sequence-order-confirm.mmd](sequence-order-confirm.mmd) | [sequence-order-confirm.drawio](preview/sequence-order-confirm.drawio) |
| 状态机 | [state-task-lifecycle.mmd](state-task-lifecycle.mmd) | [state-task-lifecycle.drawio](preview/state-task-lifecycle.drawio) |
| 结构/组件图 | [structure-service-layers.mmd](structure-service-layers.mmd) | [structure-service-layers.drawio](preview/structure-service-layers.drawio) |

原有两张雷达流程图也可用于观察较复杂的布局：[控制流程](fig-control-flow.mmd)、[探测流程](fig-detect-flow.mmd)。

## 文档尺寸

需要插入技术文档时，以目标文档版心宽度 `W_doc` 和可用页面高度为准。图按满版心宽度放置时，估算高度：`H_doc = W_doc × 图的高度 / 图的宽度`。如果超高或文字在实际放置尺寸下不可读，先调整图的方向、结构或拆分，再导出检查。
