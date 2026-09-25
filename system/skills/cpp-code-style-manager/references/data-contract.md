# 管理数据契约

## 存储与优先级

每层一份 `rules.yaml`，以 `cpp-code-style/references/rules.schema.json` 校验。活动规则路径为：

- 系统：`<用户主目录>/.agents/skill-data/cpp-code-style/system/rules.yaml`
- 用户：`<用户主目录>/.agents/skill-data/cpp-code-style/rules.yaml`
- 组织：`<用户主目录>/.agents/skill-data/cpp-code-style/organization/rules.yaml`
- 项目：`<项目根>/.agents/skill-data/cpp-code-style/rules.yaml`

项目通过 `organization.yaml` 引用组织缓存，文件只含 `schemaVersion`、`id` 和 `revision`。没有该文件时组织层为 `unbound`。

优先级为项目 > 组织 > 用户 > 系统。相同 ID 由高层完整替换低层；不同 ID 默认同时生效，只有显式 `overrides` 才表示局部覆盖关系。

## 规则结构

规则必填元数据为 `id`、`summary`、`appliesTo`、`enabled`、`severity`、`execution.check` 和 `execution.fix`。可选 `reason`、`source`、`overrides`。规则配置使用内联 `config` 或 `detail` 引用二选一；detail 必须位于本层 `details/` 下，且只含匹配的 `id` 和 `config`。

系统层必须含 `profile` 和 `baseStyle`；组织层必须含 `organization.id` 和 `organization.revision`，不得声明 `profile` 或 `baseStyle`。

## 状态与写入

规则文件状态包括 `missing`、`invalid`、`empty` 和 `valid`；组织层额外有 `unbound`。无效文件不得被当作缺失文件覆盖。

`enabled: false` 禁用当前层规则；`--unset` 删除本层覆盖并恢复继承。规则创建和修改必须经过 `propose`、完整 diff、目标层确认和 `apply --confirm <digest>`。提案过期、数据无效或路径越界时拒绝执行。

## 规则粒度与来源

每条规则只表达一个可独立确认、启用、禁用、覆盖和审查的规范意图，并针对一个主要对象和清晰范围。不同对象、不同来源章节或不同覆盖边界应拆分为不同 ID。来源元数据可以保留定位和日期，但不复制完整原文。

## 能力真实性

具名 handler 由代码注册，不允许从 YAML 执行任意命令。未知 handler 运行时报告 `not-executed`；semantic 规则需要人工审查；hybrid 规则仍必须保留语义审查。

## 变更边界

本次命令入口拆分不改变上述数据格式、字段、路径、规则 ID 或合并语义，不执行用户数据迁移或自动重写。
