---
name: cpp-code-style
description: Use when writing, reviewing, formatting, or checking C++ code against confirmed layered rules.
---

# C++ 分层代码规范

本技能负责日常 C++ 编写、审查、格式化和检查；规则初始化、发现、导入、学习、升级及维护由 sibling `cpp-code-style-manager` 负责。用户级、组织级和项目级只保存规则数据，不因调用本技能扩大任务到全仓格式化、安装、构建或规则学习。组织缓存如何构建不由本技能规定；本技能只读已确认的本机缓存和项目引用。

## 日常流程

1. 解析用户明确指定的项目根目录，运行 `status`。
2. 如果系统、用户或项目层为 `missing` 或 `invalid`，或项目已绑定组织但组织层为 `missing` 或 `invalid`，暂停依赖规范的写作或审查，转入 `cpp-code-style-manager`；不自动写入、安装或覆盖。组织层为 `unbound` 时继续使用其余已就绪层。
3. 如果已 `ready`，运行 `list` 读取元数据；根据本次涉及的文件、类型、字段、函数和注释，使用 `get` 读取所有适用复杂规则，只有在需要追溯或解释覆盖时使用 `explain`。
4. 只对明确指定的项目文件运行具名确定性处理器。保持 automated、semantic、hybrid、unavailable 和 error 的真实含义。
5. 不把聚焦任务扩大为全仓格式化、重命名、构建或规则学习。

运行时可使用共享 CLI：`python -B <skill-root>/scripts/style.py --project <项目根> status|list|get|explain|check`。提案写入时用 `--proposal-file` 保存完整提案；命令和存储细节见 [CLI 参考](references/cli.md) 与 [数据契约](references/data-contract.md)。

## 分层合并与冲突判定

判断规则关系时，必须先解析规则 ID 和 `overrides`，再判断语义是否冲突。不得仅根据 `summary`、`appliesTo` 或自然语言描述相似，就推断一条规则覆盖另一条规则或报告为优先级冲突。

合并规则如下：

1. 相同 ID：项目层完整替换组织层，组织层完整替换用户层，用户层完整替换系统层；被替换规则不再作为有效规则执行。组织层是政策，压过用户层同 ID 覆盖。
2. 不同 ID：默认同时生效，不得自动推断其中一条替代另一条。只有存在适用的 `overrides` 声明时，才按声明范围进行局部替代。
3. 格式规则：合并后的相同格式选项叶子值不一致，属于实际配置冲突；以 `validate` 结果为准，不凭人工阅读摘要判定。
4. 语义范围重叠：不同 ID 的 `appliesTo` 存在交集时，先报告为规则范围重叠。如果规则方向不同但没有覆盖声明，报告为缺少显式覆盖建模；只有确认规则内容无法同时满足时，才报告实际冲突。
5. 项目文档：README、AGENTS.md 或其他仓库规范文档不会自动成为项目规则层。只有写入项目 `rules.yaml` 的规则才参与 CLI 分层合并。外部文档与规则层不一致时，分别说明两者来源，不得假装已经完成覆盖。

发现重叠或疑似冲突时，使用以下结构报告：

```text
规则解析结果：

- 规则 A：<id>，来源：<layer>
- 规则 B：<id>，来源：<layer>
- ID 是否相同：是 / 否
- 是否存在 overrides：是 / 否
- 合并结果：<哪条生效，或两条并存>
- 判定：有效覆盖 / 规则并存 / 语义重叠 / 缺少覆盖声明 / 实际配置冲突
```

例如，`system.naming.variables` 使用 `snake_case`，而 `user.naming.identifiers` 使用 `camelCase` 时，两个 ID 不同，当前按设计同时存在；它们可能在变量命名范围上语义重叠，但不构成优先级冲突。若要替代系统规则，应在组织层或用户层使用相同的 `naming.variables` ID，或由用户明确建模适用的 `overrides`。组织层已规定的 ID，用户层同 ID 覆盖不生效。

项目层缺失时，`status` 应报告整体 `ready: false`，但仍应分别保留和说明有效的系统层、用户层和组织层规则；不得因为项目层尚未初始化，就错误否定上层规则。项目未写组织引用时，组织层为 `unbound`，不参与合并，也不阻止另外三层就绪。

## 规则粒度

建立或归一化规则时，优先拆成细粒度规则，而不是用一条规则承载大量信息。一条规则应只表达一个可独立启用、禁用、覆盖和审查的规范意图，并针对一个主要对象和清晰的适用范围。

- 不同对象、不同处置方式、不同来源章节或不同覆盖边界，通常应使用不同的规则 ID。
- 一条规则如果包含多个可以分别确认的要求，或其中任一要求可以独立报告结果，应拆分为多条规则。
- `summary` 只概括一个结论；`appliesTo` 应描述可观察且尽量窄的对象范围；`detail` 只补充同一意图的条件、例外、示例和判断依据，不能用来隐藏多个独立规则。
- 规则拆分后，即使适用范围相近，也先按不同 ID 处理；是否重叠仍按本技能的分层合并与冲突判定流程报告，不自动合并或生成 `overrides`。

例如，不要用一个宽泛的 `naming.identifiers` 同时规定变量、函数、类型和成员命名；应按对象拆成 `naming.variables`、`naming.functions`、`naming.types` 等规则。这样每条规则才能被单独审查、覆盖和维护。

## 渐进式披露

`list` 只返回元数据，不读取 detail。复杂规则必须通过 `get` 加载详情后才能执行语义判断；不能凭摘要改写代码。语义检查由审查者阅读源码和规则详情完成，不得把 `needs-review` 或 `not-executed` 当作通过。

## 检查能力

目前只有 clang-format 和 UTF-8 无 BOM 处理器已实现。命名、类型识别、注释语义等规则保持语义审查状态，不能虚构 AST 检查器或工具结果。工具版本、SDK 和编译上下文缺失时报告实际限制。

规则优先级为项目 > 组织 > 用户 > 系统。同 ID 是整条替换；不同 ID 的局部替代由 `overrides` 表达。系统活动快照位于 `<用户主目录>/.agents/skill-data/cpp-code-style/system/rules.yaml`，组织缓存在 `<用户主目录>/.agents/skill-data/cpp-code-style/organization/rules.yaml`，用户和项目规则分别位于各自层的 `rules.yaml`。项目通过 `<项目根>/.agents/skill-data/cpp-code-style/organization.yaml` 用 `id` 和 `revision` 引用本机组织缓存；无引用则组织层不生效。运行时不读取技能内 `assets`，也不自动启用仓库外的规则包。
