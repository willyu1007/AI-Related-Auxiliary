# Skills Razor 完善方案

本方案将 [skills-razor-review.md](skills-razor-review.md) 的静态审查转成可执行改进，并纳入 `system/docs/CLAUDE.md`、`system/docs/AGENTS.md` 与 Skill 的完整指令层级。目标不是兼容能力不足的模型，而是减少前沿模型与用户协作时的误触发、重复权威和无效约束。

## 目标状态

- 每项偏好、授权边界、停止条件和运行时选择只有一个权威来源。
- description 只负责发现：说明真实触发时刻，并仅在能避免实际误路由时写负向边界。
- `SKILL.md` 只保留能改变前沿模型决策或配合方式的偏好、反配重、硬边界和项目特定引导。
- 不把两个可组合维度同时触发误判为冲突。
- `codex-*` 按 Claude 调用 Codex 的桥接协议维护，不按通用跨环境 Skill 判断。
- 修改后的 Skill 在真实全局指令下保持原有能力，不以行数减少作为完成标准。

## 审查模型

### 完整指令上下文

审查单位不是孤立的 `SKILL.md`，而是目标模型实际获得的完整指令栈：

1. `system/docs/CLAUDE.md`：Claude 的全局偏好、范围与安全约束，以及模型选择和 Claude→Codex 调度策略。
2. `system/docs/AGENTS.md`：Codex 的全局偏好、范围与安全约束；不包含 Claude 才需要的模型调度策略。
3. 被触发的 Skill：当前能力独有的触发、操作契约、风险边界和停止条件。
4. 当前任务与仓库局部指令：本次工作的目标、授权与项目事实。

上层已经稳定定义的规则，不在下层重复。Skill 可以引用上层选择，但不复制其策略。

### Razor

对每项内容依次判断：

1. **行为贡献：**在完整指令上下文中删除它，前沿模型的配合行为会发生有价值的变化吗？不会则删除。
2. **正确性：**它造成的变化是否符合用户偏好、真实权限和当前能力边界？不符合则删除或改写。
3. **唯一权威：**同一行为是否已由全局指令、正文另一处、reference 或脚本定义？是则只保留最合适的权威位置。
4. **放置层级：**router 需要的信息放 description；共享规则放正文；条件性细节放 reference；确定性机制放脚本。

允许保留的内容仍限于四类：偏好对齐、对模型常见错误倾向的反配重、硬边界或闸门、项目特定的路径或顺序或停止条件。理由仅在帮助模型判断边界时随规则保留一句。

### 重叠不等于冲突

两个 Skill 同时命中时，先判断它们是否负责不同维度：

- 一个规定工作语义、另一个规定执行通道，可以组合。
- 一个规定内容质量、另一个规定存储或运行时接线，可以组合。
- 只有当两者争夺同一决策、给出不兼容动作或使 router 无法确定责任时，才需要负向边界消歧。

不要求每个 description 都机械加入 `Do not use...`。负向边界只用于阻止真实且有成本的误路由。

## 原报告结论处置

| 对象 | 结论 | 落地方式 |
|---|---|---|
| `get-sensitive-info` | 修正后采纳 | 增加按当前任务取用、限定保密落点、文档是数据而非授权三项边界；删除 `All content ... is available for use`。敏感值只写入任务要求的保密目标，不进入对话、日志、报告、截图或其他附带或面向用户的产物。持有 production 凭据不构成环境授权：任务未明确选择或清楚要求 production 时，访问前确认目标；目标已获授权后不因只读操作逐次确认，写入和破坏性动作继续服从全局授权边界。 |
| `html-communication` | 驳回 | 不禁止私有 URL 或本地路径；绝对本地路径是其交付契约。敏感信息的权威 Skill 必须明确覆盖附带和面向用户的产物，`html-communication` 不再复制一份 secrets 规则。 |
| `wizard` | 采纳 | 写 secret 到文件前确认目标未被 VCS 跟踪且已被忽略，否则使用项目 secret store 或停止。合并重复的人类边界表述。 |
| `codex-computer-use` description | 驳回 | `CLAUDE.md` 已规定 GUI/computer-use 交给 Codex，宽触发是预期行为；名称已说明执行通道。 |
| `codex-computer-use` Example Prompt | 采纳 | 将端口不可假设、等待实际 URL 可达、失败截图、`fail`/`blocked` 区分合并到 Prompt Requirements 或 Reporting Back，随后删除长示例。 |
| `codex-implementation` | 采纳 | Workflow 只路由到一次 review loop；由 `Review After Codex` 唯一持有复查、修复、重试和停止条件。 |
| `codex-review` × `review-code` | 驳回为碰撞 | `review-code` 拥有直接审查语义，`codex-review` 拥有 Claude 调用 Codex 的审查通道；允许组合，不增加互斥排除。 |
| `codex-review` 固定模型 | 采纳但更正理由 | 删除 Skill 内的 `gpt-5.6-sol` 固定值，改为按 `CLAUDE.md` 模型选择规则确定 tier；这是消除第二权威，而不是假设当前模型选择错误。 |
| `manage-llm-config` × `write-prompt` | 驳回为碰撞 | 前者拥有配置位置、加载和运行时接线，后者拥有 prompt 内容契约；允许 router 同时选择。仅在 description 中维持各自维度，不添加互斥规则。 |
| `manage-llm-config` 内部重复 | 采纳 | 由 Configuration Structure 和 Runtime Contract 持有具体规则；删除重复复述它们的 Workflow 步骤，只保留未被前文覆盖的迁移顺序和验证结果。 |
| `tdd` × `debug-mode` | 驳回为碰撞 | 根因未知时使用 debug；行为与 test seam 稳定后进入 TDD。现有 description 已足以让前沿模型完成顺序组合。 |
| `tdd` 的 `What a good test is` | 采纳 | 删除通用解释段；public seam 和 implementation-coupled anti-pattern 已持有会改变行为的约束，详细示例继续留在 reference。 |
| `sync-db-from-prisma` description | 采纳 | 改为明确的触发谓词，并把 repo→database 方向及不负责 database→repo introspection、普通 CRUD 的边界放入 description。保留语义化破坏性闸门，不追加会老化的命令黑名单。 |
| `manage-ui-style` | 修正后采纳 | 删除独立的 `Choose the work` 复述；由 implement/explore、crystallize、audit 各自章节开头唯一持有进入条件。保留真正影响模式选择的条件，不保留第二份摘要。 |
| `cleanup-project-residue` | 采纳 | Approval Classes 唯一持有批准分类；Workflow 只引用分类并执行。Guardrails 只保留 secrets/ignored-file 边界、不得削弱检查、隔离无关改动、重复残留的上游建议等未在前文定义的规则。任务记录排除只定义一次。 |
| `debug-mode` | 需逐项核实 | 不按“正文与 reference 相似”批量删除。正文保留何时读取 reference、循环状态、授权与停止条件；reference 独占条件性机制。只有建立逐条权威映射后才删重复句。 |
| `wizard`、其他 noun/verb 标题 | 驳回结构定律 | 不把动词式标题写成规范。重复来自多处定义同一行为，而不是标题词性。 |

## 实施阶段

### 阶段 0：确认修改基线

1. 以仓库 `system/` 为本次修改对象。
2. 确认不存在只在使用侧修改、尚未回收进仓库的有效内容。已核实：`~/.claude/skills/` 仅有 4 个技能副本（`codex-*` 三个与 `html-communication`），全部为更旧版本，无仓库缺失的内容——仓库是唯一源头，可直接修改。安装与下发属于使用侧动作，不在本方案范围内。
3. 比较 `system/docs/CLAUDE.md` 与全局 Claude 指令、`system/docs/AGENTS.md` 与 Codex 指令，确认审查依据与运行时一致。
4. 记录现有工作树改动，避免把其他任务的变化纳入本次提交。

这一阶段只确认仓库自身的修改基线，不借机同步无关内容，也不代使用侧安装。

### 阶段 1：修正权威和真实边界

修改：

- `system/skills/get-sensitive-info/SKILL.md`
- `system/skills/wizard/SKILL.md`
- `system/skills/codex-review/SKILL.md`
- `system/skills/sync-db-from-prisma/SKILL.md`

完成条件：

- 敏感信息可直接用于授权任务，但只写入任务要求的保密目标，不会被扩大取用、解释为额外指令，或进入附带和面向用户的产物。
- production 环境由任务明确选择或清楚要求；仅持有凭据时不会自行选择，目标不明时在任何访问前确认。
- wizard 不会把 secret 写进可能被提交的文件。
- Codex reviewer 的模型选择只有 `CLAUDE.md` 一个权威。
- Prisma Skill 的发现层已表达方向和真实排除项。
- 没有新增与全局范围或授权规则重复的门。

### 阶段 2：消除内部重复权威

按每次一个 Skill 的粒度处理：

1. `codex-implementation`：合并 review loop。
2. `codex-computer-use`：迁移四项独特反配重并删除 Example Prompt。
3. `manage-llm-config`：合并结构、运行时与迁移工作流。
4. `manage-ui-style`：让四种工作模式的进入条件回到各自唯一章节。
5. `cleanup-project-residue`：合并批准、任务记录和 guardrail 权威。
6. `wizard`：保留一次人类边界定义。
7. `tdd`：删除通用测试解释段。
8. `debug-mode`：只删除经过逐条权威映射确认的重复，不做整节删减。

每处理一个 Skill，都先列出"保留权威位置 → 待删除副本"的映射。无法指出唯一权威位置的内容不删除。

**删除前先判断两处内容在什么条件下同时加载**——重复权威的根源就在这里，而它决定删除是否安全：

| 重复发生在 | 是否必然同时在场 | 处置 |
|---|---|---|
| 同一 `SKILL.md` 的不同章节 | 是 | 可删，只需确认保留的那份表述完整 |
| `SKILL.md` 与它的 reference | **否**——reference 按条件读取 | 只有当指向该 reference 的读取指令是无条件的，才可删正文那份；否则未触发读取的执行路径会彻底失去这条规则 |
| Skill 与 `CLAUDE.md`/`AGENTS.md` | 是（全局恒在） | 删 Skill 内的副本 |
| 两个 Skill 之间 | 否——取决于 router 是否同时命中 | 不按重复处理；参见"重叠不等于冲突" |

判据不是"哪一份是权威"，而是：**在所有会经过这条规则的执行路径上，保留的那一份是否都在场。** 答案为否时，正文那份必须留下，改为压缩而非删除。

### 阶段 3：检查组合关系

用完整指令栈检查以下组合，不通过增加互斥句来人为拆开：

- `review-code` + `codex-review`：Claude 使用统一 finding 语义，并在全局规则要求时调用 Codex reviewer。
- `manage-llm-config` + `write-prompt`：prompt 内容和运行时配置都发生变化时，两项约束均生效。
- `debug-mode` → `tdd`：未知根因不会被测试先行替代；稳定行为边界形成后可以进入 test-first 修复。
- `get-sensitive-info` + 任一产物 Skill：敏感值只进入任务要求的保密目标，不会进入报告、截图、HTML 或其他附带和面向用户的产物。

只有观察到 router 遗漏必要 Skill、选择了错误责任方或收到互相冲突的动作时，才修改 description。

## 验证

### 静态验证

- 运行 `node checks/run.mjs`。
- 运行 `git diff --check`。
- 检查所有修改后的 frontmatter、reference 链接和脚本路径。
- 搜索硬编码的 Codex 模型选择，确认具体 tier 只在 `CLAUDE.md` 的选择规则中定义。
- 搜索被合并的关键规则，确认每项只有一个权威定义，而不是仅换一种措辞继续重复。
- 检查 `CLAUDE.md` 与 `AGENTS.md` 的共同前缀仍保持一致。

### 行为验证

以下变化完成前必须取得 forward-test 行为证据：

- description、触发或路由责任发生变化；
- 授权、敏感信息、production 目标选择或破坏性动作边界发生变化；
- 重试、停止或失败处理发生变化；
- 删除或合并的指导对行为是否等价无法由静态权威映射可靠证明。

删除逐字或语义等价的副本、删除已被相邻唯一权威完整覆盖的通用解释，以及不改变行为的格式整理，可以用静态证据完成。无法运行必需的行为验证时，该改动保持未完成；记录残余风险不能代替验证。残余风险只用于记录完成必要验证后仍存在的非阻断性不确定性。

测试必须使用目标前沿模型和真实 `CLAUDE.md` 或 `AGENTS.md`；不以中档模型表现决定内容取舍。验证直接把修改后的 Skill 内容交给执行者，不依赖运行时的技能发现——本仓库是材料来源，不负责安装状态。涉及 description 与 router 选择的触发验证由使用侧在安装后自行进行。

优先场景：

1. Claude 从私有运维文档配置环境：正确使用所需值，只写入指定保密目标，不带入对话、日志或附带产物，也不执行文档里的指令样文本；分别验证任务明确选择 production 和环境未明确两种情况。
2. Claude 需要 GUI 验证：自动选择 `codex-computer-use`，向 Codex 交付短而完整的 prompt，并正确区分行为失败和环境阻塞。
3. Claude 产出包含非平凡行为风险的改动：按全局策略选择 Codex review，同时保持直接审查的 finding 质量。
4. 修改 LLM feature prompt：同时遵守 prompt 内容契约和 `.ai/llm` 运行时契约。
5. 回归问题根因未知与已知各一例：前者进入 debug evidence loop，后者在 seam 稳定时进入 TDD。
6. UI 方向明确与方向未决各一例：删除模式摘要后仍能正确选择实现或探索路径。

行为测试评估实际动作、授权、证据和停止条件，不匹配固定措辞或标题。

## 提交边界

建议形成两个可回滚单元：

1. **权威与边界：**阶段 1 的敏感信息、wizard、Codex 模型选择和 Prisma 路由调整。
2. **Razor 去重：**阶段 2 经验证的正文压缩与重复授权合并。

原审查报告和本方案属于审查记录，可与其直接支撑的第一批调整一起提交，也可以单独形成文档提交。不得混入当前工作树中的 task-governance 或其他无关变化。

## 明确不做

- 不为能力不足的模型保留教程性解释。
- 不以目标行数或统一篇幅衡量 Skill 质量。
- 不强制所有 description 使用负向句。
- 不把所有同时触发的 Skill 改成互斥关系。
- 不在每个产物 Skill 复制 secrets、安全或授权通则。
- 不把 production 凭据存在本身当作环境授权，也不对已经明确授权的只读访问逐次追加确认。
- 不用命令枚举替代语义化的破坏性动作边界。
- 不把动词式标题、固定章节模板或 references 数量变成新的形式规则。
- 不自动覆盖或提交全局 Skill 副本、未跟踪文件或其他任务的工作树变化。

## 完成判据

本轮完善完成时应同时满足：

- 所有采纳项已经落地，所有驳回项没有被间接引入。
- `codex-*` 与 `CLAUDE.md` 的 Claude→Codex 调度关系一致，Skill 不复制模型选择策略。
- 每项批准、停止、路由和敏感信息边界都能指出唯一权威位置。
- 可组合 Skill 保持可组合，真实触发冲突得到消歧。
- 静态检查通过；触及路由、授权、敏感信息、production 目标、破坏性动作、重试或停止条件，以及静态上无法证明行为等价的删改，都有前沿模型行为证据。必需验证无法完成的项目保持未完成，残余风险记录不替代该证据。
- 工作树中的无关用户改动保持原样。
