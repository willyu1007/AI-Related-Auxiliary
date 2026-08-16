# AI-Related-Auxiliary

存放 AI 相关辅助材料的仓库，例如 Cursor Skill、说明文档、提示词模板和规则片段。

本仓库不是应用程序，而是一份可复用的资料库，方便在不同项目之间共享和迭代。

## 目录约定

后续内容建议按类型归类：

```text
.
├── skills/          # Cursor / Agent Skill（每个 Skill 一个目录，内含 SKILL.md）
├── docs/            # 说明文档、设计笔记、使用指南
├── prompts/         # 可复用的提示词模板
└── rules/           # 可复用的 Agent 规则或编码约定
```

新增材料时：

- 一个 Skill 单独放在 `skills/<skill-name>/` 下，入口文件为 `SKILL.md`
- 文档使用 Markdown，文件名用小写短横线（例如 `docs/skill-authoring.md`）
- 不要提交密钥、本地环境变量或个人机器路径

## Skill 示例结构

```text
skills/example-skill/
├── SKILL.md
└── references/      # 可选：补充说明或示例
```

`SKILL.md` 建议包含：适用场景、使用方式、约束，以及必要的输入输出说明。

## 使用方式

按需把本仓库中的 Skill、规则或文档复制到目标项目，或在本仓库内直接维护后再分发。

## 贡献

提交前请确认：

- 内容可复用，不绑定某一台机器或某个私有密钥
- 新增 Skill 有明确的触发场景和边界
- 文档能独立阅读，不依赖未提交的本地文件
