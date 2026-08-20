# AI-Related-Auxiliary

可复用的 AI 辅助材料库：Agent Skill、规则片段、说明文档。

**本仓库不执行任何东西。** 里面的内容——包括脚本——都是被复制出去使用的材料，不是运行时。

## 结构

```text
system/          # 库本身：跟着人走的全局层
  skills/        #   所有 Skill，一层平铺（发现只扫这一层）
    <skill>/
      SKILL.md
      templates/ examples/ references/  # 随技能走的资产
      assets/<bundle>/                  # 技能装进目标仓库的东西，按目标仓库的目录形状摆好
  docs/          #   全局 Agent 指令（CLAUDE.md / AGENTS.md）
checks/          # 本仓库自己的校验，不是分发物
  run.mjs
  skills/<skill>.sh   #   技能级冒烟测试
```

**一个技能自带它需要的一切。** 要在目标仓库里放东西（控制脚本、契约、模板、空目录）时，那些东西放在该技能的 `assets/<bundle>/` 下，由技能自己的 install 命令幂等地写进去。没有需要先装的 pack，技能正文里也就没有"如果 X 存在"这类分支。

控制脚本必须落进目标仓库，这不是风格选择：Git 钩子按仓库路径调用它，够不到 `~/.claude/skills/`。

技能发现只扫 `system/skills/` 的第一层，所以那一层保持平铺，不要建分组子目录。

## system/ —— 技能

任务治理的七个技能，按实际操作划分 —— 每个对应工作流程里的一个时刻。主线是 `start → plan → implementation`；新证据推翻路线时回到 plan，实施检查点通过 `sync → resume` 走仓库跨越时间，`handoff → 新会话` 则通过对话完成零间隔交接。

| Skill | 时刻 | 通道 |
|---|---|---|
| [task-start](system/skills/task-start/SKILL.md) | 开任务：查重、建立带 pending roadmap seed 的 bundle、分配 ID 并注册进 hub；**持有 Task Contract 与项目资产** | 仓库 |
| [task-plan](system/skills/task-plan/SKILL.md) | 持续收敛顶层决策、完成实施 kickoff，并在新证据推翻路线时 replan | 仓库 + 对话 |
| [task-sync](system/skills/task-sync/SKILL.md) | 把记录与仓库现实拉平，保持当前态证据而非追加流水账；**持有 Git 钩子** | 仓库 |
| [project-hub-maintain](system/skills/project-hub-maintain/SKILL.md) | 执行已选任务的归档转换，或修复 hub/registry 与派生视图漂移 | 仓库 |
| [task-resume](system/skills/task-resume/SKILL.md) | 冷启动：只凭仓库重建已跟踪任务的上下文 | 仓库 |
| [task-handoff](system/skills/task-handoff/SKILL.md) | 热交接：上下文降质时，把当前工作提炼成可粘贴的块 | **对话** |
| [project-status](system/skills/project-status/SKILL.md) | 跨任务的只读进度、归档就绪度与 hub 漂移审计 | 仓库 |

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

`system/` 是全局 Agent 配置的版本化镜像。改动流程：

```bash
# 从本仓库同步到全局
cp -R system/skills/. ~/.claude/skills/
cp system/docs/CLAUDE.md ~/.claude/CLAUDE.md
cp system/docs/AGENTS.md ~/.codex/AGENTS.md

# 从全局回收改动到本仓库
cp -R ~/.claude/skills/. system/skills/
cp ~/.claude/CLAUDE.md system/docs/CLAUDE.md
cp ~/.codex/AGENTS.md system/docs/AGENTS.md
```

`AGENTS.md` 是 `CLAUDE.md` 去掉末尾"选模型"那一节 —— 那节讲的是怎么调度 Codex 和 Claude 子 agent，对读 `AGENTS.md` 的 Codex 自己没有意义。两份共有的部分必须逐字一致，`checks/run.mjs` 用前缀比对盯着：改了一边没改另一边，检查会红。

## 校验

```bash
node checks/run.mjs
```

两部分。**静态检查**扫描 `system/`：引用的脚本是否真有人提供（悬空引用是仓库退役后最容易留下的坑）、钩子有没有可执行位（缺了 git 只 warn 然后静默跳过）、有无机器绝对路径、技能之间有没有互相提名、两份全局文档有没有漂移。**冒烟测试**从一个空的临时 git 仓库出发，由 `checks/skills/<skill>.sh` 调技能自己的 install 命令把仓库装起来 —— 被测的正是那条命令，而不是只有测试知道怎么写的 `cp -R`。

`checks/` **不是分发物** —— 它校验这个库，`system/` 才是库本身。这也是本仓库唯一会执行的东西。

其他用法：

```bash
node checks/run.mjs --static             # 只跑静态检查
node checks/run.mjs --only task-start    # 只冒烟测一个技能
```

## 贡献约定

- 内容必须可复用：不绑定某台机器、某个密钥、某条个人路径。
- 一条规则只定义一次。每个技能只写自己那一刀，完整的规范交给脚本的 `lint` 去机器校验——复制粘贴出来的第二份一定会静默漂移。
- 技能之间不互相提名。要跳到别的技能时，说该做的动作，让 router 去选人。
- 每个 Skill 都要写清边界：**不做什么**和做什么同样重要。
- 文档要能独立读懂，不依赖未提交的本地文件。
