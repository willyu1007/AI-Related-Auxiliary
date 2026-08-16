# AI-Related-Auxiliary

可复用的 AI 辅助材料库：Agent Skill、规则片段、说明文档。

**本仓库不执行任何东西。** 里面的内容——包括脚本——都是被复制出去使用的材料，不是运行时。

## 两层结构

```text
system/          # 全局层：跟着人走，镜像 ~/.claude/
  skills/        #   在所有项目里生效的 Skill
  docs/          #   全局 Agent 指令（CLAUDE.md / AGENTS.md）
packs/           # 项目层：跟着项目走，按需复制进目标仓库
  <pack-name>/
    PACK.md      #   这是什么 / 依赖什么 / 怎么装 / 不做什么
    files/       #   原样复制到目标项目根目录
    verify.sh    #   冒烟测试（不随包分发）
checks/          # 本仓库自己的校验，不是分发物
```

分层的依据很简单：**一个能力是绑在人身上还是绑在项目上。**

`system/` 里的东西对每个项目都成立，装一次即可（例如「用 Codex 做独立 review」）。`packs/`
里的东西只对采用了某套约定的项目成立，必须随项目安装（例如「任务文档放在 `dev-docs/` 下」）。

## system/ —— 全局层

`system/` 是 `~/.claude/` 的版本化镜像。改动流程：

```bash
# 从本仓库同步到全局
cp -R system/skills/. ~/.claude/skills/
cp system/docs/CLAUDE.md ~/.claude/CLAUDE.md

# 从全局回收改动到本仓库
cp -R ~/.claude/skills/. system/skills/
cp ~/.claude/CLAUDE.md system/docs/CLAUDE.md
```

## packs/ —— 项目层

见 [packs/README.md](packs/README.md)。安装永远是同一条命令：

```bash
cp -R packs/<pack-name>/files/. /path/to/your/project/
```

当前可用：

| Pack | 能力 | 依赖 |
|------|------|------|
| [dev-docs-continuity](packs/dev-docs-continuity/PACK.md) | 任务文档 bundle、跨会话续接、commit 关联 | 无 |
| [project-hub](packs/project-hub/PACK.md) | 任务聚合成 Milestone/Feature/Requirement 视图，带校验与同步 | Node、dev-docs-continuity |
| [plan-visualizer](packs/plan-visualizer/PACK.md) | 交互式 HTML 计划产物 | 无 |

## 校验

```bash
node checks/run.mjs
```

两部分。**静态检查**扫描 `packs/`：引用的脚本是否都随包提供（悬空引用是仓库退役后最容易留下的坑）、
钩子有没有可执行位（缺了 git 只 warn 然后静默跳过）、有无机器绝对路径。**冒烟测试**把每个 pack
按文档里那条 `cp -R` 装进临时 git 仓库，再跑该 pack 的 `verify.sh`。

`checks/` 和 `packs/*/verify.sh` 都**不是分发物** —— 它们校验这个库，`packs/*/files/` 才是库本身。
这也是本仓库唯一会执行的东西。

其他用法：

```bash
node checks/run.mjs --static              # 只跑静态检查
node checks/run.mjs --only project-hub    # 只冒烟测一个 pack
```

## 贡献约定

- 内容必须可复用：不绑定某台机器、某个密钥、某条个人路径。
- 一条规则只定义一次。跨 pack 需要同一条规则时，一个 pack 拥有它，另一个引用它——
  复制粘贴出来的第二份一定会静默漂移。
- 每个 Skill / Pack 都要写清边界：**不做什么**和做什么同样重要。
- 文档要能独立读懂，不依赖未提交的本地文件。
