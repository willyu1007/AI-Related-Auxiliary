# AI-Related-Auxiliary

可复用的 AI 辅助材料库：Agent Skill、共享仓库设施和全局 Agent 指令。

**`system/` 是分发物。** 本仓库有三个执行入口：`install-task-governance.mjs` 初始化目标仓库的 `.ai/` 与 `dev-docs/`；`install-system-auxiliary.mjs` 把技能与全局文档同步进本机各 Agent 目录；`checks/run.mjs` 校验这个库本身。`system/` 中的脚本随资源安装进目标仓库后运行，不以本仓库作为运行时。

## 结构

```text
install-task-governance.mjs     # 目标仓库 .ai/ 与 dev-docs/ 初始化，可从 git 拉取
install-system-auxiliary.mjs    # 按档位同步 skills 与全局文档到 ~/.claude ~/.codex ~/.cursor
system/          # 库本身：跟着人走的全局层
  skills/        #   所有 Skill，一层平铺（发现只扫这一层）
    <skill>/
      SKILL.md
      assets/ examples/ references/ templates/  # 按需存在，只服务该技能
  resources/     #   多个 Skill 共用的系统设施
    task-governance/
      install.mjs
      project/                           # 安装进目标仓库的固定设施
        .ai/project/                     # hub 契约与初始视图模板
        .ai/scripts/                     # 治理 CLI 与实现
        dev-docs/                        # 契约、目录骨架、开任务源模板
  docs/          #   全局 Agent 指令（CLAUDE.md / AGENTS.md）
checks/          # 本仓库自己的校验，不是分发物
  run.mjs
```

普通 Skill 应保持自包含；但依赖同一套仓库协议、控制脚本或持久化格式的工作流，可以共享 `system/resources/` 中的系统设施。此时 `system/` 是完整发布单元，不能只复制其中一个依赖设施的 Skill。

`task-*`、`project-*` 与 `goal-mode` 依赖 `task-governance`。用它们之前，目标仓库必须已经具备它提供的固定设施：

- `.ai/scripts/` — 治理 CLI
- `.ai/project/` — hub 契约与初始数据
- `dev-docs/` — 任务文档契约、目录骨架，以及 `templates/` 开任务源模板

设施来源是 `system/resources/task-governance/project/`，不是手写一份近似结构。落地方式二选一：

1. **脚本（推荐）** — 在目标仓库根目录运行 `install-task-governance.mjs`；本地没有本库时加 `--from-git`。默认不覆盖已有固定设施；内容不同时先 `--dry-run --refresh`，再显式 `--refresh`。
2. **手动复制** — 把 `project/` 下的固定文件拷进目标仓库根目录，缺失的 hub 数据按 `project/.ai/project/templates/` 初始化。不要改相对布局。

这些技能常作为系统 Skill，一律从 `<repo-root>` 读。缺设施时去 https://github.com/willyu1007/AI-Related-Auxiliary 取 `system/resources/task-governance/project/`。

控制脚本仍要落进目标仓库：这样任务记录与仓库内的契约一起工作，其他机器、LLM 或 CI 不需要知道全局资源安装在哪里。

安装后的 task bundle 以 `.ai-task.json`、`00-roadmap.md`、`01-status.md`、`02-architecture.md` 和 `verification.md` 分别承载身份、计划、进展、设计与验证事实；`.ai/project/registry.json` 持有跨任务的 Milestone、Feature、Idea 和 task mapping。治理 CLI 提供安装、lint、全局或 scoped sync、跨 worktree query、resume packet 与项目视图重建。

技能发现只扫 `system/skills/` 的第一层，所以那一层保持平铺，不要建分组子目录。

## system/ —— 24 个技能

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

另有 16 个与任务治理无关的技能：

| Skill | 用途 |
|---|---|
| [codex-computer-use](system/skills/codex-computer-use/SKILL.md) | 当代码和 shell 不足时，通过 GUI、截图、模拟器或实时应用状态完成或验证工作 |
| [codex-implementation](system/skills/codex-implementation/SKILL.md) | 把已明确的行为或设计交给 Codex CLI 实施，并保留调用方的范围、审查和交付责任 |
| [codex-review](system/skills/codex-review/SKILL.md) | 使用 Codex CLI 审查实施计划或代码改动，并按产出模型确定主审或补充审查角色 |
| [html-communication](system/skills/html-communication/SKILL.md) | 把计划、报告、比较或 UI mock 交付为便携、无脚本的 HTML 工作文档 |
| [research](system/skills/research/SKILL.md) | 对需要多来源、时效性或可追溯引用的外部问题做有界调查，并返回可由调用方消费的证据结论 |
| [review-code](system/skills/review-code/SKILL.md) | 直接审查代码：圈定范围、对齐审查意图，在已授权时边审边修，并报告已修复与未解决问题 |
| [sync-db-from-prisma](system/skills/sync-db-from-prisma/SKILL.md) | Prisma repo→DB migration 闸门：预览、单独的 apply 批准、按环境应用、验证 |
| [manage-llm-config](system/skills/manage-llm-config/SKILL.md) | 集中管理 agent/workflow 的模型、参数、Prompt 与 Provider 配置；通过共享加载器读取 `.ai/llm` |
| [debug-mode](system/skills/debug-mode/SKILL.md) | 根因不明故障的证据循环：准确症状信号、可证伪假设、授权修复、原始复现验证与自动清理 |
| [get-sensitive-info](system/skills/get-sensitive-info/SKILL.md) | 获取并使用 `~/Documents/LLM/project-ops.md` 中的项目敏感信息；按项目标准机制落地配置，缺失内容用中文占位符反写并返回可点击文档链接 |
| [manage-ui-style](system/skills/manage-ui-style/SKILL.md) | 继承、探索并沉淀项目 UI 风格，在需要时审计和修复视觉漂移 |
| [cleanup-project-residue](system/skills/cleanup-project-residue/SKILL.md) | 清理当前 session、任务、近期工作或全项目中的过时测试、冗余内容、语义漂移、双轨/legacy 残留和技术债；证据+批准后删除，校验门收尾 |
| [resolve-vcs-conflicts](system/skills/resolve-vcs-conflicts/SKILL.md) | 在已获授权且进行中的 merge、rebase、cherry-pick 或 revert 中恢复双方意图并解决 Git 冲突 |
| [tdd](system/skills/tdd/SKILL.md) | 在行为与测试 seam 足够稳定时，以 red → green → refactor 推进测试优先实现 |
| [wizard](system/skills/wizard/SKILL.md) | 为必须由用户持有私密访问、MFA 或实体设备才能完成的步骤生成临时交互式向导 |
| [write-prompt](system/skills/write-prompt/SKILL.md) | 为另一个 LLM、subagent、CLI agent 或运行时模型编写独立执行边界的 Prompt |

## 触发方式

技能有两种触发方式，且同一个技能可以兼具：**用户点名**（响应用户的直接要求）与**模型自发**（工作途中识别时刻，用户没有要求这件事本身）。归属读各技能 description 的现行措辞即可，这里不维护花名册——那是会静默漂移的第二份副本。

两个极端才值得写下来。有破坏性或纯问答的技能只应由用户点名，description 里会写死 "user explicitly asks"（如 cleanup-project-residue）。反过来，有些义务对应的时刻**没有用户话语**——没人会说"现在做个检查点"或"现在把提示词写规范"——这类技能必须由处境触发，这也是它们存在的理由。

`system/` 是全局 Agent 配置的版本化镜像。改动流程：

三级档位是包含关系：`minimal` / 最小集（治理主线 + review / research / tdd）、`general` / 通用（再加日常调试、UI、HTML、清理和 Codex）、`all` / 全量（再加 write-prompt、wizard、敏感信息、Prisma、`.ai/llm`）。默认 `general`。`.codex` 在通用和全量下仍不装三个 `codex-*` 技能。

```bash
# 从本仓库同步到全局：skills 按目录整体替换，当前档以外的本库技能会从目标删掉；
# 默认 general；.codex 不装 codex-*；AGENTS.md 落 ~/.codex 和 ~/.cursor，CLAUDE.md 落 ~/.claude
node install-system-auxiliary.mjs
node install-system-auxiliary.mjs --profile minimal
node install-system-auxiliary.mjs --profile all

# resources/ 不在脚本范围内，仍手动同步（各 Agent 环境里 resources/ 必须与 skills/ 同级）
cp -R system/resources/. ~/.claude/resources/
cp -R system/resources/. ~/.codex/resources/
cp -R system/resources/. ~/.cursor/resources/
```

目标仓库初始化（脚本最省事；等价做法是按上一节手动复制 `project/`）：

```bash
node install-task-governance.mjs
node install-task-governance.mjs --from-git --dry-run
```

也可把该脚本拷到目标仓库根目录再跑。它写入 `.ai/`、`dev-docs/` 和 `dev-docs/templates/`。

从全局回收改动到本仓库时，按实际改过的 Agent 目录回拷：

```bash
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

`checks/` **不是分发物** —— 它校验这个库，`system/` 才是库本身。`install-task-governance.mjs` 只负责初始化目标仓库，不参与库内容校验。

## 高质量 Skill

模型把它当系统 Skill 加载，当前工作区是目标仓库。按这个情景写：

- **对齐使用偏好** — 只写模型推不出的偏好、会滑向的默认、硬边界。删了行为不变的行不要留。
- **相信模型** — 给条件、路径、动作。不解释原理，不预演失败。
- **从使用情景写** — 仓库内设施写 `<repo-root>/...`；Skill 自带材料写本目录的 `references/`、`templates/`。不要从 Skill 的安装位置往外跳。
- **引导，不介绍** — 步骤回答「此刻做什么、缺什么、去哪取」。不写背景、花名册、独立论证。
- **自包含** — 普通 Skill 不点名其他 Skill；共享协议进 `resources/`。`goal-mode` 是唯一编排例外。
- **一处定义** — 规则只写一次。能 lint 的交给脚本。
- **写清边界** — 不做什么和做什么同样重要。
- **可复用** — 不绑机器、密钥、个人路径。不依赖未提交的本地文件。
