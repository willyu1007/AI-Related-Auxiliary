# AI-Related-Auxiliary

可复用的 AI 辅助材料库：Agent Skill、规则片段、说明文档。

**本仓库不执行任何东西。** 里面的内容——包括脚本——都是被复制出去使用的材料，不是运行时。

## 结构

```text
system/          # 库本身：跟着人走的全局层
  skills/        #   所有 Skill，一层平铺（发现只扫这一层）
    <skill>/
      SKILL.md
      examples/ references/             # 只服务该技能的材料
  resources/     #   多个 Skill 共用的系统设施
    task-governance/
      install.mjs
      project/                         # 安装进目标仓库的固定设施
      templates/                       # 与设施契约同步的任务模板
  docs/          #   全局 Agent 指令（CLAUDE.md / AGENTS.md）
checks/          # 本仓库自己的校验，不是分发物
  run.mjs
```

普通 Skill 应保持自包含；但依赖同一套仓库协议、控制脚本或持久化格式的工作流，可以共享 `system/resources/` 中的系统设施。此时 `system/` 是完整发布单元，不能只复制其中一个依赖设施的 Skill。

`task-*`、`project-*` 与 `goal-mode` 工作流依赖 `task-governance`。它集中持有项目内 `.ai/` 运行时、`dev-docs` 契约和配套模板；`task-start` 在首次使用时将它初始化到目标仓库，其他相关 Skill 使用项目内已安装的设施。默认安装不会覆盖已有固定设施；内容不同时必须先预览并显式 refresh。每个 Agent 环境中的 `resources/` 必须与 `skills/` 同级，资源相对路径才能保持稳定。

控制脚本仍要落进目标仓库：这样任务记录与仓库内的契约一起工作，其他机器、LLM 或 CI 不需要知道全局资源安装在哪里。

技能发现只扫 `system/skills/` 的第一层，所以那一层保持平铺，不要建分组子目录。

## system/ —— 技能

任务治理的八个技能按实际操作划分；其中 `goal-mode` 串联同一 Goal 运行内的长任务主线，其余每个对应工作流程里的一个时刻。主线是 `start → plan → implementation`；新证据推翻路线时回到 plan，实施检查点通过 `sync → resume` 走仓库跨越时间，`handoff → 新会话` 则通过对话完成普通任务的零间隔交接。

| Skill | 时刻 | 通道 |
|---|---|---|
| [task-start](system/skills/task-start/SKILL.md) | 开任务：查重、提炼目标、建立经用户确认的 pending roadmap seed、分配 ID 并注册进 hub | 仓库 |
| [task-plan](system/skills/task-plan/SKILL.md) | 持续收敛顶层决策、完成实施 kickoff，并在新证据推翻路线时 replan | 仓库 + 对话 |
| [task-sync](system/skills/task-sync/SKILL.md) | 把记录与仓库现实拉平，保持当前态证据而非追加流水账 | 仓库 |
| [project-hub-maintain](system/skills/project-hub-maintain/SKILL.md) | 执行任务归档、已确认的 Milestone / Feature / Idea / task mapping 变更，或修复 hub 与派生视图漂移 | 仓库 |
| [task-resume](system/skills/task-resume/SKILL.md) | 冷启动：只凭仓库重建已跟踪任务的上下文 | 仓库 |
| [task-handoff](system/skills/task-handoff/SKILL.md) | 热交接：上下文降质时，把当前工作提炼成可粘贴的块 | **对话** |
| [project-status](system/skills/project-status/SKILL.md) | 一项或多项任务及项目 hub 的只读状态、归档就绪度与一致性审查 | 仓库 |
| [goal-mode](system/skills/goal-mode/SKILL.md) | 在同一 Goal 运行内串联 start、planning、分阶段执行、checkpoint、恢复与完成契约 | 仓库 + 对话 |

另有与任务治理无关的技能：

| Skill | 用途 |
|---|---|
| `codex-*`（三个） / `html-communication` | 见各自 `SKILL.md` |
| [research](system/skills/research/SKILL.md) | 对需要多来源、时效性或可追溯引用的外部问题做有界调查，并返回可由调用方消费的证据结论 |
| [review-code](system/skills/review-code/SKILL.md) | 直接审查代码：圈定范围、对齐审查意图，在已授权时边审边修，并报告已修复与未解决问题 |
| [sync-db-from-prisma](system/skills/sync-db-from-prisma/SKILL.md) | Prisma repo→DB migration 闸门：预览、单独的 apply 批准、按环境应用、验证 |
| [manage-llm-config](system/skills/manage-llm-config/SKILL.md) | 集中管理 agent/workflow 的模型、参数、Prompt 与 Provider 配置；通过共享加载器读取 `.ai/llm` |
| [debug-mode](system/skills/debug-mode/SKILL.md) | 根因不明故障的证据循环：准确症状信号、可证伪假设、授权修复、原始复现验证与自动清理 |
| [get-sensitive-info](system/skills/get-sensitive-info/SKILL.md) | 获取并使用 `~/Documents/LLM/project-ops.md` 中的项目敏感信息；按项目标准机制落地配置，缺失内容用中文占位符反写并返回可点击文档链接 |
| [manage-ui-style](system/skills/manage-ui-style/SKILL.md) | 继承、探索并沉淀项目 UI 风格，在需要时审计和修复视觉漂移 |
| [cleanup-project-residue](system/skills/cleanup-project-residue/SKILL.md) | 清理当前 session、任务、近期工作或全项目中的过时测试、冗余内容、语义漂移、双轨/legacy 残留和技术债；证据+批准后删除，校验门收尾 |

## 触发方式

技能有两种触发方式，且同一个技能可以兼具：**用户点名**（响应用户的直接要求）与**模型自发**（工作途中识别时刻，用户没有要求这件事本身）。归属读各技能 description 的现行措辞即可，这里不维护花名册——那是会静默漂移的第二份副本。

两个极端才值得写下来。有破坏性或纯问答的技能只应由用户点名，description 里会写死 "user explicitly asks"（如 cleanup-project-residue）。反过来，有些义务对应的时刻**没有用户话语**——没人会说"现在做个检查点"或"现在把提示词写规范"——这类技能必须由处境触发，这也是它们存在的理由。

`system/` 是全局 Agent 配置的版本化镜像。改动流程：

```bash
# 从本仓库同步到全局
cp -R system/skills/. ~/.claude/skills/
cp -R system/resources/. ~/.claude/resources/
cp system/docs/CLAUDE.md ~/.claude/CLAUDE.md
cp system/docs/AGENTS.md ~/.codex/AGENTS.md

# 从全局回收改动到本仓库
cp -R ~/.claude/skills/. system/skills/
cp -R ~/.claude/resources/. system/resources/
cp ~/.claude/CLAUDE.md system/docs/CLAUDE.md
cp ~/.codex/AGENTS.md system/docs/AGENTS.md
```

`AGENTS.md` 是 `CLAUDE.md` 去掉末尾"选模型"那一节 —— 那节讲的是怎么调度 Codex 和 Claude 子 agent，对读 `AGENTS.md` 的 Codex 自己没有意义。两份共有的部分必须逐字一致，`checks/run.mjs` 用前缀比对盯着：改了一边没改另一边，检查会红。

## 校验

```bash
node checks/run.mjs
```

这是轻量静态检查：扫描 `system/` 中的悬空脚本引用、机器绝对路径、技能间耦合、技能发现布局，以及两份全局文档的漂移。行为验证留给使用这些材料的目标仓库，不在这个纯储存仓库里维护复制出来的集成测试。

`checks/` **不是分发物** —— 它校验这个库，`system/` 才是库本身。这也是本仓库唯一会执行的东西。

## 贡献约定

- 内容必须可复用：不绑定某台机器、某个密钥、某条个人路径。
- 一条规则只定义一次。每个技能只写自己那一刀，完整的规范交给脚本的 `lint` 去机器校验——复制粘贴出来的第二份一定会静默漂移。
- 普通技能之间不互相提名；负责串联长任务的 `goal-mode` 是显式校验的编排例外。
- 一行文字要么对齐一个模型推不出的偏好，要么抵消一个明知故犯的默认，要么是硬边界或引导；删掉后行为不变的行不该存在。
- 理由只在支撑边界判断时保留：一句话、挂在规则上。独立成段的论证是说教。
- 每个 Skill 都要写清边界：**不做什么**和做什么同样重要。
- 文档要能独立读懂，不依赖未提交的本地文件。
