# `write-prompt` 技能检查报告

审查对象：`system/skills/write-prompt/`（`SKILL.md` 85 行 + `references/instruction-layers.md` 51 行 + `references/runtime-prompts.md` 48 行）。

审查方式：静态检查 + 逐句阅读 + 与同级技能的路由和体例对照。未做代入执行验证（见文末"未覆盖的验证"）。

## 结论

**概念质量是库内最高的一档，可执行性是最低的一档。**

它把提示词正确地重新定义为**执行边界上的契约**，由此派生的推论都成立且非显然。但通篇在定义正确性，很少给出可执行动作：读完知道什么是对的，不一定知道下一步敲什么。

机械检查全过：`node checks/run.mjs` 全绿，命名、层级、无机器路径、无跨技能提名均合规。

## 路由

无碰撞。描述采用"正向触发 + 负向边界"的库内标准形态，与 `task-plan` 同构。

与 `codex-implementation` 的关系清晰：后者触发的是"让 Codex 改仓库"这件**差事**，本技能是"如何写好那份提示词"这门**手艺**，负向边界（不用于当前对话回复与普通面向用户散文）也已排除最常见的误触发。

## 成立的部分

核心命题一句立住，后续全部由它派生：

> Treat a prompt as the contract at an execution boundary. The receiver can act only on the context, authority, tools, and permissions that actually cross it.

以下几条属于模型先验中缺失、且高频被违反的判断：

- **`SKILL.md:32`** —— *A path, URL, or named artifact is not context when the receiver cannot resolve it.* 直击"写了路径就等于给了上下文"这一最常见失败。
- **`SKILL.md:37`** —— *Do not transfer ambiguity merely because another model will execute the work.* 点名"反正让它自己判断"这一真实诱惑。
- **`SKILL.md:54`** —— *Never expand the caller's outcome, scope, or authorization to make the prompt more self-contained.* 指出自包含压力会导致越权与扩范围，属非显然的洞察。
- **`instruction-layers.md`** —— *A system prompt may direct how available capabilities are used; it is not an access-control mechanism.* 纠正普遍认知错误，并把执行点正确归还给 runtime。
- **`runtime-prompts.md`** —— *Do not repair a prompt file that the call site does not load*，以及 *Judge behavior at the consumer boundary rather than wording or prompt snapshots*。两条都是真实陷阱；末尾"跑不了真实调用链就明说该限制，不要把静态检查当作行为证明"与库内其他技能的诚实验证纪律一致。

分支结构（共享工作流 + 两份按需读取的引用）正确，篇幅在库内属中位。

## 待改进项

按收益排序。

### 1. 全篇零示例

库内 `task-start` 带 `examples/`，本技能只有 `references/`。其他技能可以不给示例（`task-sync` 给的是文件职责表），但**教人写东西却不展示一份写好的东西**，落差在此最大。

建议补一份"坏提示词 → 修订版"的对照，逐处改动标注对应规则。该项收益大于其余全部改动之和。

### 2. 密度过高，无法逐条执行

典型见 `SKILL.md:70`：

> Remove instructions that do not change behavior, duplicate another authority, restate cheaply discoverable environment facts, explain rather than direct, or serve only a branch this prompt cannot take.

一句话内含五条独立删除判据，每条都成立，但无法逐条核查，也无法被引用。对照 `manage-ui-style` 的反模式清单：编号、可检索、可引用。

建议拆成编号列表。

### 3. 缺失败名录

库内最实用的文件之所以实用，是因为命名了**一眼可辨的具体失败**；本技能命名的是**正确性的类别**。

缺口示例：粘贴整段对话因为"上下文有用"；写"你是资深 X 专家"这类不改变任何行为的开场；要求调用方根本不解析的报告格式；引用"我们刚才说的那个文件"；用"要全面"代替可观察的完成条件；把工具 schema 抄成散文；过度规定步骤导致接收方无法适配。

其中数条已被抽象覆盖，但**认不出来即等同于未覆盖**。

### 4. 主工作流的验证弱于分支

`runtime-prompts.md` 有真实测试矩阵（正常 / 歧义 / 失败 / 含指令的不可信输入）；主工作流仅三条自问式确认。

缺最便宜且最有效的一条：**以接收方身份、在无任何其他上下文的前提下通读，问自己第一步会做什么**。答不上来即说明上下文未真正跨过边界。

### 5. 无按接收方能力校准的规则

`SKILL.md:52` 的 *Match detail to the receiver's actual context* 只是暗示，未给判据。

考虑到全局指令中已有按 intelligence 分层选择模型的规则，本技能完全不提接收方能力层是实质缺口。建议补一条方向性判断：接收方能力越弱，完成条件与边界越需显式；能力越强，越应给目标而非步骤。

### 6. 体例瑕疵

`SKILL.md:84` 是全篇唯一谈论技能自身而非工作的段落，读感上像在回应读者未提出的质疑。可并入授权边界的正文表述。

## 未覆盖的验证

本次仅做静态审查。库内其他技能采用的"埋雷 fixture + 中档模型实测"未在此技能上执行，因此以下问题无法排除：

- 抽象表述在真实执行时是否会导致产出"清单形态但质量不高"的提示词；
- 两份引用的分支选择规则在边界情形（既是系统级又是运行时可复用）下是否清晰。

若要补验证，建议设计为：给定一份含多种典型缺陷的真实提示词，要求按本技能修订，检查修订是否命中缺陷、是否引入越权或扩范围。

---

## 附记：前向测试结果（2026-08-21）

按"未覆盖的验证"一节的设计执行了前向测试：在可运行的 review-bot fixture 中埋入 9 类缺陷（人设开场、过期对话、不可解析引用、占位符双向失配、散文工具 schema、模糊完成条件、输出与消费方失配、越权扩范围、权威冲突与未定界输入），由中档模型仅凭本技能修订。

**结果：9/9 全部命中，每处修复均引用了驱动它的具体规则句；未引入越权或扩范围；失败处理选择了 fail-safe 方向（无法解析时返回 unsure 转人工，而非默认放行）。**

据此修正本报告：

- 主结论"可执行性最低"**被证伪**。类别形态的规则足以让中档模型识别并纠正实例级失败；第 1 项（示例）与第 3 项（失败名录）建议撤回，`write-prompt-review-assessment.md` 的"无证据不加"立场得到实测支持。
- 第 2 项（编号拆分）无证据支持，维持不采纳。
- 第 4、5 项已按评估报告的改进版落地，实测中均被执行者引用并正确应用。
- 实测暴露的唯一真缺口：执行者的修订把提示词变成了 reusable system prompt，但未随之重估分支条件、未读 instruction-layers.md，导致对 system 角色优先级语义做了无依据假设——尽管"Read both references for a reusable system prompt"一句已覆盖该情形。候选修法为一行引导（修订改变提示词形态时重估分支），是否采纳待定。
