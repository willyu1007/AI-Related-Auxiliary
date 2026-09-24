---
name: uml-diagrams
description: 以内容 JSON 与布局脚本生成 draw.io UML 图，支持通用图、类图、时序图、流程图和状态机图，并执行统一视觉质检。
---

# UML 图生成技能

本技能负责 UML/流程图/状态机图的语义内容、布局和 draw.io 导出；文档技能只引用图并将 PNG 嵌入 DOCX。

## 输入与产物

每张图的唯一编辑源是 `media/<basename>.uml-content.json`。布局脚本读取内容 JSON 生成同名 `.drawio`，再由 draw.io CLI 导出同名 `.png`。

```text
内容 JSON → 布局脚本 → draw.io → PNG 视觉质检 → 用户确认 → 终版导出
```

内容 JSON 禁止写绝对路径和 `..`；`.drawio` 不作为语义源直接编辑。

## 布局脚本

| 类型 | 脚本 | 输入要点 |
|---|---|---|
| auto | `scripts/autolayout.py` | `nodes` + `edges` 通用图 |
| class | `scripts/classlayout.py` | UML 类节点与关系 |
| sequence | `scripts/seqlayout.py` | `participants` + `messages` |
| workflow | `scripts/workflowlayout.py` | `nodes` + `edges`，开始/结束必须为扁圆 |
| state-machine | `scripts/statemachinelayout.py` | `states` + `transitions`，开始/结束必须为扁圆 |

流程图和状态机图统一使用“开始”“结束”文字扁圆起止符，不使用实心黑点；“关机”不是终态。起止符规则在布局阶段生成，不在 DOCX modify 阶段补写。

“画布收紧”仅表示根据节点和连线的外包围盒重设 draw.io 页面宽高，并保留固定安全边距；不移动业务节点、不删除留白语义、不改写内容 JSON。它属于导出前的布局后处理。

## 视觉质检

必须阅读并执行：

- `references/drawio-layout.md`
- `references/uml-visual-qa-framework.md`
- `references/uml-visual-qa-by-type.md`

复杂图先导出预览并检查标签、连线、重叠、画布边界和起止符；问题修复后再请求用户逐图确认。draw.io CLI 缺失时停止并报告，不得使用替代导出脚本。
