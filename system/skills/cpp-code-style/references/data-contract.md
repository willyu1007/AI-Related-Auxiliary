# 数据契约

## 存储与优先级

每层一份 `rules.yaml`，以 `rules.schema.json` 校验。活动规则路径为：

- 系统：`<用户主目录>/.agents/skill-data/cpp-code-style/system/rules.yaml`
- 用户：`<用户主目录>/.agents/skill-data/cpp-code-style/rules.yaml`
- 项目：`<项目根>/.agents/skill-data/cpp-code-style/rules.yaml`

优先级为项目 > 用户 > 系统。系统层必须包含顶层 `profile` 和 `baseStyle`；`profile` 只能出现在系统层，包含 `id`、`name`、`origin`、`revision` 和 `sources`。`origin` 为 `bundled` 或 `custom`，来源保存类型、定位和日期，不复制完整原文。运行时不为缺失 `baseStyle` 静默补入 LLVM、Google 或其他预设。

`baseStyle` 选择 clang-format 外部格式预设；`toolchain.clangFormatVersion` 可固定精确版本号。系统快照可以来自技能内 bundled profile，也可以来自用户提供的 URL、文件或文档。

## 初始化状态

规则文件本身表达状态：缺失为 `missing`，存在但校验失败为 `invalid`，有效且零规则为 `empty`，有效且有规则为 `valid`。`empty` 是已初始化状态，不是待办状态；三层都为 `empty` 或 `valid` 才是 `ready`。无效文件不得被当作缺失文件覆盖。`status` 只读且不得创建目录。

## 规则结构

`rules` 是按稳定 ID 标识的列表。必填元数据：`id`、`summary`、`appliesTo`、`enabled`、`severity`、`execution.check`、`execution.fix`。`severity` 使用 `required`/`advisory`；执行能力使用 `automated`、`semantic`、`hybrid`、`unavailable`。

可选 `reason`、`source`、`overrides`。`config` 内联或 `detail` 引用二选一。详情路径必须在本层 `details/` 下且为 `.yaml`；详情文件只含匹配的 `id` 和 `config`。`config` 可包含 `handler`、`options`、`requirement`、`parameters`、`selection`、`exceptions`、`check`、`fix`、`examples`、`references`。

## 合并

同 ID：项目整条替换用户，用户整条替换系统，包括 config/详情。不同 ID 组合生效；格式规则的原生选项按嵌套叶子汇总，重复叶子报冲突。修改格式参数时保存该层完整 ID 配置，不对同 ID config 深合并。

`enabled: false` 禁用该 ID；`unset` 删除本层覆盖并恢复继承。上下级相同的显式设置仍保留。`overrides` 只在更具体适用范围内替代其他 ID，不全局删除；工具检测悬空引用和循环，语义重叠由审查者判断。

仓库 README、AGENTS.md 或其他规范文档是项目发现阶段的证据，不是规则层数据。只有明确写入项目 `rules.yaml` 的规则才参与 CLI 的分层合并；文档与规则层不一致时，必须分别报告来源和状态。

## 规则粒度

每条规则只表达一个可独立确认、启用、禁用、覆盖和审查的规范意图，并针对一个主要对象和清晰范围。不同对象、不同来源章节或不同覆盖边界应拆分为不同 ID。`summary` 只描述一个结论，`appliesTo` 尽量具体；`detail` 只能补充同一意图的条件、例外和示例，不能成为多个独立要求的容器。

## 能力真实性

具名 handler 由代码注册，不允许从 YAML 执行任意命令。现有 handler：

- `clang-format`：自动检查和修复；原生 options 由实际安装版本验证。
- `utf8-no-bom`：自动检查，无自动修复；不猜测其他原编码。

未知 handler 可以登记，但运行报告 `not-executed`。semantic 规则不需要 handler；hybrid 需要具名自动部分且仍需要语义审查。`list` 不加载详情或探测外部工具，readiness 为 `not-probed`；`explain` 按需探测。

## 手工维护与提案

允许手工编辑，之后运行 `validate`。YAML 重复键、重复 ID、错误参数和路径越界不接受。`propose` 按 ID upsert，不移除未提及规则；显式 `--unset` 才删除覆盖。所有层的写入都必须经过提案、完整 diff、目标层确认和 `apply --confirm <digest>`。提案过期则拒绝，重新生成并确认。

写入以单文件原子替换实现，异常时回滚已写文件；不是跨进程事务。详情删除只清理由本次替换或 unset 造成的不再引用文件。系统升级是差异提案，永不自动写入；custom 系统 profile 不受 bundled catalog 自动替换。

## 检查结果

`pass` 表示已实现检查通过；`violation` 表示发现问题；`needs-review` 表示待语义审查；`not-executed` 表示能力或依赖未就绪；`error` 表示执行失败。完整 check 只在所有结果为 `pass` 时返回 0，待处理返回 1，配置、参数或执行异常返回 2。`advisory` 当前同样报告并影响完整检查退出码。

`.clang-format` 是单独显示的项目目标；`--with-format` 可把它纳入提案，并且即使内容无差异也纳入过期检查。详情路径比较前规范化，等价路径不误删。项目用自身 Git 管理规则历史；本工具不自动提升项目规则到用户层。
