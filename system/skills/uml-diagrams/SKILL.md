---
name: uml-diagrams
description: 以内容 JSON 与布局脚本生成 draw.io UML 图，支持通用图、类图、对象图、用例图、时序图、通信图、时间图、活动图、流程图、状态机图和结构部署图，并执行统一视觉质检。
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
| class | `scripts/classlayout.py` | 类名、带可见性和类型的属性、带参数和返回值的操作；关系用 `kind` |
| sequence | `scripts/seqlayout.py` | `participants` + `messages` |
| workflow | `scripts/workflowlayout.py` | 一个节点只写一个步骤；框按文字收紧；开始/结束必须为扁圆 |
| state-machine | `scripts/statemachinelayout.py` | `states` + `transitions`，开始/结束必须为扁圆 |
| object | `scripts/objectlayout.py` | 实例 `name` / `class` / `slots` 与链接 |
| usecase | `scripts/usecaselayout.py` | `actors` 在系统边界外，`usecases` 在边界内；`include` / `extend` 为虚线 |
| activity | `scripts/activitylayout.py` | `lanes` + `nodes` + `edges`；初始/终止节点、分叉条和汇合条 |
| architecture | `scripts/architecturelayout.py` | 分层 `layers`；`query` 走层间左侧间隙，`response` 走层下通道 |
| communication | `scripts/communicationlayout.py` | `objects` + 按顺序编号的 `messages` |
| timing | `scripts/timinglayout.py` | 共用 `ticks`，各生命线 `states` 与刻度等长，变化走垂直阶梯 |
| ipo | `scripts/ipolayout.py` | `inputs`、`steps`、`outputs` 各是单项列表，禁止把多项塞进一个框 |

流程图和状态机图统一使用“开始”“结束”文字扁圆起止符，不使用实心黑点；“关机”不是终态。起止符规则在布局阶段生成，不在 DOCX modify 阶段补写。

一个节点只表达一个类成员、一个步骤或一个输入输出项。类图属性写成 `{visibility, name, type}`，操作写成 `{visibility, name, parameters, returnType}`。关系用 `kind`：`inheritance`、`association`、`dependency` 分别对应空心三角、实心箭头和虚线开口箭头。同一节点发出的多条边必须使用不同锚点。流程图和结构图不要预写过大的 `width`/`height`；流程图交给 `workflowlayout.py` 按文字定框。功能 IPO 使用 `ipolayout.py` 的三列单项，不要把输入、处理、输出各写成一个多行大框。

“画布收紧”仅表示根据节点和连线的外包围盒重设 draw.io 页面宽高，并保留固定安全边距；不移动业务节点、不删除留白语义、不改写内容 JSON。它属于导出前的布局后处理。

## 视觉质检

必须阅读并执行：

- `references/drawio-layout.md`
- `references/uml-visual-qa-framework.md`
- `references/uml-visual-qa-by-type.md`

复杂图先导出预览并检查标签、连线、重叠、画布边界和起止符；问题修复后再请求用户逐图确认。draw.io CLI 缺失时停止并报告，不得使用替代导出脚本。
