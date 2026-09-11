---
name: cpp-code-style-manager
description: Initialize and maintain the confirmed system, user, and project C++ rule layers.
---

# C++ 规范管理

本技能用于初始化、发现规则、导入用户提供的来源、学习个人偏好、升级内置规则包，以及修改、禁用或删除规则。其生成的分层规则由 sibling `cpp-code-style` 技能在编写和审查 C++ 时使用。

始终以本技能目录为基准，将共享 CLI 解析为 `../cpp-code-style/scripts/style.py`。如果文件不存在，应报告缺失的依赖；不得安装任一技能或任何依赖，也不得在此处创建重复实现。

有序初始化和维护流程见 [initialization.md](references/initialization.md)；需要解释或归一化规则来源时，阅读 [source-normalization.md](references/source-normalization.md)。

建立或修改规则时，必须优先拆分为细粒度、单一意图的规则。每条规则只对应一个可独立确认、启用、禁用、覆盖和审查的规范要求，以及一个清晰的主要对象范围。不同对象、不同来源章节或不同覆盖边界应使用不同 ID；不要用宽泛的 `summary`、`appliesTo` 或 `detail` 把多个独立要求包装成一条规则。

先运行 `status`。按系统、用户、项目的顺序处理缺失层。每次变更前，都要展示准确的提案内容、目标路径、目标层级、来源和覆盖影响。使用 `propose` 生成提案，询问用户是否确认展示的提案及目标层级，然后使用 `apply --confirm <digest>`。digest 只用于标识提案，不代表用户同意。

正常流程禁止 Agent 直接手工编辑任何 `rules.yaml` 或 `details/*.yaml`。只有用户明确授权的应急托底、或 `apply` 已经完成诊断但无法继续时，才可以手工修复目标层；手工修改后必须立即运行 `validate`，不得跳过校验或把手工修改当作常规写入路径。

内置规则包是 `assets/system-profiles/` 下的本地快照；初始化时不得访问其官方网站来源。用户提供的 URL、文件或文档属于独立的自定义来源流程，必须保留来源元数据，但不能将来源原文复制到规则数据中。

任务中的纠正不等于持久化授权。已有数据无效时，应阻止流程并禁止覆盖。后续确认被拒绝或对话中断时，保留已经完成的层。不得自动格式化仓库、重命名符号、构建 C++、修改外部引擎。
