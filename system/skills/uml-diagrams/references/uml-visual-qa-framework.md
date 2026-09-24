# UML 视觉质检框架（供 model-docx 自动化流程使用）

适用范围：`drawio` 技术图中状态机、时序图、类图、主流程图、部署/组件图、活动图等 UML 与半 UML 图。

## 1. 三层审查体系

### 1.1 通用视觉（Geometry）

- 节点重叠：类、泳道、状态框、动作框不得不合理重叠；
- 标签重叠：节点/边文字不得与其他文字重叠；
- 边线穿透：边线不得穿过无关节点、关键标签和箭头；
- 边线交叉：避免非必要交叉，尽量少于 6 次；
- 边标签压线：文字不得贴边覆盖边或节点；
- 文本溢出：标签不得超出边界；
- 页面边界：节点不应超出可见画布边缘；
- 裁剪与空白：无白边截断，空白过大需收画布。

### 1.2 UML 语义（Semantics）

- 形状语义是否与图类型一致（时序生命线、状态转移、继承/依赖、include/extend、消息箭头方向）；
- 生命周期/边界是否可辨（特别是 alt/loop/opt/par、聚合/组合、入口/出口箭头语义）；
- 标签和事件要素是否对齐正确端点（multiplicity、event/guard/action 等）；
- 关键语义元素缺失或替换即判定阻断。

### 1.3 布局与可读性（Layout/Readability）

- 主方向清晰：流程图自上而下、时序图横向参与者并列、状态机主链可跟踪；
- 层次与分组清楚：父子关系、分支/汇合、泳道边界清晰；
- 间距与层次：同层对齐、边距不拥挤、可读距离足够；
- 可读性：缩小到阅读尺寸后仍能快速理解。

### 1.4 渲染可靠性（Rendering）

- 目标图在 PNG 中不缺边、不缺字、箭头方向不反；
- 起止图元、终态标识、生命周期线、激活块能正常显示；
- draw.io 与导出链路（无 `-e` 预览、有 `-e` 终版）保持一致。

## 2. 问题级别与处理策略

| 等级 | 含义 | 处理 |
|---|---|---|
| `CRITICAL` | UML 语义/结构错误 | 必须修复后才能继续 |
| `ERROR` | 严重视觉/结构错误 | 必须修复后继续 |
| `WARNING` | 明显影响阅读 | 建议修复，必要时可过会签 |
| `INFO` | 优化建议 | 可作为后续提效项 |

示例 `CRITICAL`：时序图缺 lifeline、状态机起止图元错误；
示例 `ERROR`：返回消息箭头缺失、边线覆盖关键文字；
示例 `WARNING`：标签留白不足；
示例 `INFO`：局部间距可再优化。

## 3. 固定工作流（必走）

- Step A：生成原始 UML JSON，并落盘到 `media/<basename>.uml-content.json`。
- Step B：按图类型选择布局脚本生成 `media/<basename>.drawio`。
  - sequence：`.agents/skills/uml-diagrams/scripts/seqlayout.py`
  - class：`.agents/skills/uml-diagrams/scripts/classlayout.py`
  - workflow：`.agents/skills/uml-diagrams/scripts/workflowlayout.py`
  - state-machine：`.agents/skills/uml-diagrams/scripts/statemachinelayout.py`
  - 其他 UML：优先 `.agents/skills/uml-diagrams/scripts/autolayout.py`，复杂图或自动布局失效时手工微调。
- Step C：draw.io CLI 导出预览 PNG（非 `-e`，`--width 2000`）。
- Step D：独立 AI 审查（优先独立子 Agent）给出分级问题清单。
- Step E：每张图单独提交用户确认，不得跳过；若有修改返回 Step B-C-D 重试。
- Step F：人工确认通过后再做终版导出（如需嵌入 XML）并进入构建链。

通过条件：
- `CRITICAL` 为 0；
- `ERROR` 为 0；
- WARNING 可在用户放行说明后收束。

## 4. 与现有标准链接

- 与 draw.io 风格/连线要求交叉时，取最严格规则；
- 类型特殊规则详见 [UML 按类型检查清单](references/uml-visual-qa-by-type.md)。
