# Task 治理实施说明

本文只描述当前实现；演进过程由 Git 历史保留，不在运行文档中形成第二套叙述。

## 目标与边界

Task 治理让 LLM 与开发者围绕同一份仓库事实协作：需要持久跟踪的工作形成 task bundle，项目级语义进入 hub，实施过程通过 Git、task checkpoint 和明确的 authority 恢复。它不替普通的一次性工作增加流程，也不把 roadmap、`Done when` 或 hub 投影当成完成事实。

`task-start` 的职责止于创建一个经用户确认、无重复的 opening checkpoint：提炼一个 outcome，给出边界与当前 acceptance references，形成可供用户判断的初步路线，分配 Task ID，并确认 project placement。实施 readiness 由后续 planning 收敛；kickoff 为 `ready` 前不开始依赖该路线的实现。

## 发布与安装模型

- `system/resources/task-governance/` 是共享设施的唯一源码位置。
- `project/` 中的 `.ai/` 运行时和 `dev-docs` 契约安装到目标 Git 仓库；`templates/` 供 task workflow 创建 bundle。
- 依赖该设施的 `task-*`、`project-*` 和 `goal-mode` 必须与同级 `resources/` 一起分发。
- 默认安装只补齐缺失的固定设施；现有固定文件内容不同时停止。覆盖需要单独预览并显式使用 `--refresh`。
- Registry、dashboard 和 feature map 是项目拥有的数据，只在缺失时初始化，不由 refresh 覆盖。
- 安装器只处理当前设施，不包含资源版本或格式迁移逻辑。

## Authority 与生命周期

- `01-status.md` 是 task head：一个当前 Goal、状态、阶段、下一步、blocker 和当前 `Done when` acceptance references。
- `00-roadmap.md` 保存顶层决策、任务关系、分阶段路线与独立的 kickoff gate；它不定义第二个 Goal。
- `02-architecture.md` 只保存当前已确定的设计和接口；`verification.md` 保存计划检查与最新决定性证据。
- `.ai-task.json` 只保存稳定身份与搜索元数据。`.ai/project/registry.json` 保存 Milestone、Feature、task mapping 与轻量 Idea；task 行是 bundle 的派生投影。
- Task `done` 同时要求 outcome 闭环、实现或产物质量过关、语义收敛。Roadmap exit criteria 和勾选的 `Done when` 只作为执行与验收参考，不能独立证明完成。
- Archive 是完成后的独立、需批准的破坏性转换，不由 sync 或 `done` 自动触发。

## Worktree 与证据语义

- Query 跨 linked worktree 合并同一 Task ID。完整 bundle 内容与 registry 投影共同参与 freshness 判断。
- Git 能证明单向线性演进时，最新 occurrence 提供事实，旧副本进入 `stale_worktrees`；内容相同的副本互为 co-leader。
- 并发分歧、无共同谱系或证据不可读产生 `conflict: true`。仅文档内容分歧时使用 `documents` conflict，并提供 reason、内容等价组与失败阶段。
- Worktree、branch history 或 task root 无法枚举时 fail closed；不存在的目录和尚无 ref 的仓库是明确允许的空状态。
- Stale worktree 中的 sync 只同步该 worktree 的本地现实，不把较新副本反向写入旧 bundle。
- Task mapping 在同一 Task 有多个 checked-out 副本时停止；Milestone 或 Feature 同 ID 的跨 worktree 语义分歧也是停止条件。
- `sync --prune` 只根据本地 branch tip 中通过精确 schema 与 slug/path 校验的稳定 Task ID 证据删除孤立投影；存活或不可验证的证据均拒绝删除。

## 实现地图

- `system/resources/task-governance/install.mjs`：目标仓库校验、缺失安装、内容漂移拒绝和显式 refresh。
- `system/resources/task-governance/project/.ai/scripts/ctl-project-governance.mjs`：CLI 入口与参数路由。
- `system/resources/task-governance/project/.ai/scripts/lib/governance-read.mjs`：只读解析、跨 worktree 查询、freshness、conflict 与 resume packet。
- `system/resources/task-governance/project/.ai/scripts/lib/governance-write.mjs`：sync、ID 分配、mapping、project graph 与 prune 写操作。
- `system/resources/task-governance/project/.ai/scripts/lib/governance-lint.mjs`：当前 schema、authority 与派生视图一致性检查。
- `system/resources/task-governance/project/dev-docs/AGENTS.md` 与 `system/resources/task-governance/project/.ai/project/AGENTS.md`：task 和 hub 的稳定语义契约。
- `system/resources/task-governance/templates/`：与上述契约一致的 bundle 起始形状。

## 验证边界

本仓库是材料库，只维护防止分发物漂移的轻量静态检查：

```bash
node checks/run.mjs
find system/resources/task-governance -name '*.mjs' -print0 | xargs -0 -n1 node --check
git diff --check
```

设施语义发生变化时，还应在临时 Git 仓库验证初始化、幂等、固定文件漂移拒绝、显式 refresh、query、sync、lint 与 resume 输出。临时验证不作为第二套持久测试或 fixture 留在本材料库。

## 已知范围

- Prune 只检查本地 `refs/heads` 的 tip；远端 ref、tag 与 reflog 不属于删除证据。
- Bundle digest 包含 bundle 目录下的全部文件，包括未提交和未跟踪内容；临时文件因此会使副本呈现为已变化。
- 目标项目应按自身平台、Git 策略和 CI 集成验证行为；本仓库的静态 runner 不宣称替代目标环境验收。
