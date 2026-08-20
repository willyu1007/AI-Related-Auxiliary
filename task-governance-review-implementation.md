# Task 治理系统审查与实施记录

日期：2026-08-20（第四轮返工后重写）
范围：task-start 治理脚本与资产、7 个 task/project skill、`checks/` 行为契约

本文档记录四轮工作：第一轮按初始审查直接实施跨 worktree 重构；第二轮按质量复审返工并确立折中语义；第三轮补齐完整 bundle freshness、prune 身份证据与语义传播；第四轮把 fail-closed 边界推进到证据枚举层，并补齐 prune 的 metadata schema 校验与 `documents` 冲突诊断。本文以第四轮完成后的最终状态为准。

## 最终语义（用户确认的折中方案，含第三、四轮细化）

跨 worktree 分歧按对象分层处理：

- **Task bundle 层采用 git-mediated，且新旧以完整 bundle 内容判定**：freshness 依据完整 bundle 内容 digest（经 `git hash-object --stdin-paths` 走 checkout 过滤器，CRLF 不产生假脏，路径经 stdin 传递不受命令行长度限制）加 registry 投影，而不只是查询字段——只发生在 roadmap、architecture、verification 或 supporting document 中的演进同样参与判定。Git 能证明线性演进（自 merge-base 只有一侧变更，未提交修改计入）时，最新 occurrence 提供整行事实并作为 resume 的路由目标，严格更旧的副本列入 `stale_worktrees`；内容等价的副本互为 co-leader，不标记 stale。并发分歧、无提交谱系、历史不相关、证据不可读，一律 `conflict: true` 并阻断写操作。
- **`documents` 冲突携带可操作诊断**：仅存在于非查询文档的分歧或不可证证据以合成的 `documents` 冲突呈现，其 `reason` 区分 `concurrent-divergence`、`unrelated-history`、`missing-lineage`、`unreadable-evidence`；`values` 按内容 digest 等价组列出各 worktree；`evidence` 指出失败的 occurrence（worktree 路径、bundle 路径）与失败阶段（如 `worktree-content`、`head-bundle`、`merge-base`、`base-bundle`）。恢复流程据此判断应协调并发编辑还是修复 Git/证据环境。
- **证据枚举本身 fail-closed**：`git worktree list`、`git log --all` 或 task-root 目录读取失败时，所有治理命令停止而不是退化为"空"或"只有当前 worktree"；已注册但目录丢失的 linked worktree 是不可读证据（提示先 `git worktree prune` 或修复）。仅两类状态是合法的空：目录确实不存在（该处尚未安装治理），以及仓库尚无任何 ref（尚无分支历史）。
- **两类语义权威写操作保持 fail-closed**：`map` 变更映射时任务存在多个 checked-out 副本即停止；Milestone/Feature 同 ID 在 linked worktree registry 间的任何取值分歧都是硬错误。
- **stale worktree 中的 sync 只记录本地现实**：绝不把最新 occurrence 的事实导入本地 bundle；恢复与实施应在最新 occurrence 进行，或先通过 Git 将本 worktree 拉平。该边界已写入 `.ai/project/AGENTS.md`、task-sync workflow 与 CLI help。
- **prune 以稳定 Task ID 加精确 schema 验证分支证据**：`sync --prune` 遍历所有本地 branch tip，对 `dev-docs/active|archive/<slug>/.ai-task.json` 执行与工作区相同的精确 metadata schema 校验（`parseTaskMeta`），并核对 metadata slug 与 bundle 目录名一致，再按 `task_id` 匹配——从不依赖 registry 中可能过期的路径或 slug。schema 漂移、slug/路径不一致、JSON 损坏均视为不可验证证据而拒绝删除，绝不解释为"任务不存在"。

## 复审发现的处置

每轮复审的发现均逐项处置（不再维护跨轮总数，避免总账漂移）。第三轮处置见下表一，第四轮处置见下表二。

第三轮发现与处置：

| # | 发现 | 处置 |
|---|---|---|
| 1 | 查询字段相同时非查询文档的演进不参与新旧判定，resume 可能读旧 bundle | `mergeTaskOccurrences` 对所有多 occurrence 行运行基于完整 bundle 内容 digest 的谱系判断；线性演进路由到最新副本，非查询文档的并发/不可证分歧合成 `documents` 冲突 fail-closed |
| 2 | prune 按旧路径与 slug 查找，改名后误删存活投影 | `findTaskBranchTips` 改为在每个 branch tip 上按 `.ai-task.json.task_id` 查找 |
| 3 | 折中语义未完整传播到 skill 与 CLI | task-start 最终验证区分线性（非停止）与 conflict（停止）；task-sync 增加 stale worktree 检查点边界；CLI help 与 AGENTS.md 同步全部规则 |
| 4 | keywords 测试未验证 3–8 数量契约 | fixture 改为 3 个关键词并断言数量在 3–8 范围内 |
| 5 | 验证记录缺 POSIX shell 前提 | 本文档验证一节已注明 |

第四轮发现与处置：

| # | 发现 | 处置 |
|---|---|---|
| 1 | worktree/branch-history/目录枚举 fail-open：失败退化为"只有当前 worktree"或空集合 | `listGitWorktrees` 枚举失败或任一已注册 worktree 目录缺失即抛错；`taskIdsFromAllBranches` 先经 `for-each-ref` 区分"尚无 ref"（合法空）与命令失败（抛错）；`listImmediateChildDirs` 仅将 `ENOENT` 视为合法空，其余读取失败抛错；CLI 与安装脚本顶层捕获并以错误退出，全部写路径零写入 |
| 2 | prune 分支 metadata 只做 `JSON.parse`，schema 漂移与 slug 不一致可绕过 | `findTaskBranchTips` 复用 `parseTaskMeta` 做精确 schema 校验并核对 metadata slug 与目录名；任何不合规证据使 prune 整体不可验证并拒绝 |
| 3 | 合成 `documents` 冲突缺乏可操作证据（单一 value、原因不分） | `resolveStaleTaskOccurrences` 失败时返回 `{failure: {reason, groups, evidence}}`；`merge-base` 经退出码区分"无共同祖先"（`unrelated-history`）与命令失败（`unreadable-evidence`）；冲突输出含 reason、内容等价组与失败阶段 |
| 4 | bundle 文件列表单次命令行传递，可能触及 Windows 命令行长度限制 | `worktreeBundleDigest` 改用 `git hash-object --stdin-paths`，路径经 stdin 传递 |
| 5 | rename smoke 提交的是 slug/path 不一致的非法 bundle；缺 malformed/schema-drift 拒绝测试 | rename fixture 改为同时更新目录与 metadata slug 的合法改名；新增 slug 漂移分支与 JSON 损坏分支的 prune 拒绝测试 |
| 6 | 实施记录数量总账不可复原；"编辑文件 linter"验证项不可复现 | 删除跨轮总数，只保留逐项处置表；验证表仅保留可复现命令 |

## 代码与文档变更（当前累计状态）

- `assets/project/.ai/scripts/lib/governance-read.mjs`
  - `listGitWorktrees` / `taskIdsFromAllBranches` / `listImmediateChildDirs`：枚举失败抛错，仅"目录不存在"与"仓库无任何 ref"是合法空；已注册但目录缺失的 worktree 抛错并提示修复。
  - `runGit` 支持 stdin 输入；新增 `runGitWithStatus` 保留退出码，供 `merge-base` 区分无共同祖先与命令失败。
  - `worktreeBundleDigest`（`hash-object --stdin-paths`）/ `committedBundleDigest`：工作区与提交内的 bundle 内容 digest；`''` 表示不存在、`null` 表示证据不可读。
  - `resolveStaleTaskOccurrences`：以内容 digest + 投影为等价键做支配判断；返回 `{equal}`、`{leader, stale}` 或 `{failure: {reason, groups, evidence}}`。
  - `mergeTaskOccurrences`：所有多 occurrence 行都做谱系判断；不可证且查询字段相等时合成带 reason/等价组/失败阶段的 `documents` 冲突。
- `assets/project/.ai/scripts/lib/governance-write.mjs`
  - `cmdMap`：多副本 remap 停止守卫（原始消息）。
  - `collectProjectGraphFromAllWorktrees`：M/F 同 ID 分歧硬错误。
  - `cmdSync --prune` + `findTaskBranchTips`：branch tip 证据按精确 metadata schema（`parseTaskMeta`）+ slug/目录一致性 + Task ID 匹配；linked worktree 存活、分支存活、证据不可验证三类均拒绝并警告。
- `scripts/install-project-governance.mjs`：顶层捕获枚举类异常，以 `[error] Installation aborted` 退出。
- `assets/project/.ai/project/AGENTS.md`、`ctl-project-governance.mjs` usage、`task-start/SKILL.md`、`task-sync/SKILL.md`、`task-resume/SKILL.md`、`project-hub-maintain/SKILL.md`：与上述语义一致（含 `documents` 冲突 reason 的恢复指引、枚举 fail-closed 与 branch-tip schema 规则）。

## 持久测试（checks/skills/task-start.sh）

- 等价副本合并且 `stale_worktrees` 为空；等价多副本上 no-op map 放行、变更 map 停止且零写入。
- 无提交谱系副本 → conflict，sync 拒绝。
- architecture-only 与 verification-only 的单侧演进 → query 路由到最新副本、resume 退出码 4 指向该 worktree。
- 非查询文档（roadmap）双侧并发 → 合成 `documents` 冲突且 `reason` 为 `concurrent-divergence`、`values` 为三个单-worktree 内容等价组；sync 拒绝。
- 状态字段的单侧未提交 / 已提交演进 → 线性解析，stale 侧 sync 可写且不导入外来事实。
- 双侧等价最新 + 一侧落后 → co-leader，stale 只含落后副本。
- 状态字段并发分歧 → conflict、resume 退出码 2、sync/map 拒绝且状态零变更。
- 证据枚举失败：已注册 worktree 目录被删除后，query/resume/sync/prune 全部失败且治理状态零变更；`git worktree prune` 后恢复。
- prune：bundle 在侧分支被**合法改名**（目录与 metadata slug 同步更新）后仍被 Task ID 识别 → dry-run 点名该分支、apply 拒绝删除；slug 漂移分支与 JSON 损坏分支 → 证据不可验证、拒绝删除且投影保留；全部证据分支删除后 → dry-run 出计划且不写、apply 删除、lint --strict 通过。
- keywords：写入 3 个关键词 → sync 保留且数量在 3–8 契约内 → `query --text` 命中。
- resume 退出码 3（任务不存在）与 4（最新状态在其他 worktree）分离断言。

## 验证记录（2026-08-20，第四轮）

| 检查 | 结果 |
|---|---|
| `node checks/run.mjs`（static + 全部 smoke） | 通过 |
| `node --check` 全部治理 `.mjs` 与安装脚本 | 通过 |
| `git diff --check` | 通过（仅 CRLF 提示，无空白错误） |

环境前提：smoke 通过 `sh` 执行（POSIX shell）。在 Windows PowerShell 下需先让 Git Bash 的 `sh` 可发现，例如：

```powershell
$env:PATH = 'C:\Program Files\Git\usr\bin;' + $env:PATH
node checks/run.mjs
```

仓库状态：本仓库根目录当前没有安装 `.ai/`（无 `registry.json`、无 `ctl-project-governance.mjs`）；治理系统仅以 skill 资产形式存在于 `system/skills/task-start/assets/`，由安装脚本部署到目标仓库。

## 已知边界

- prune 的分支证据只检查本地 `refs/heads` 的 tip；远端 ref、tag、reflog 不在范围内。bundle 在所有 tip 上被删除即视为已被有意移除，历史由 Git 保留。
- bundle 内容 digest 覆盖 bundle 目录下全部文件（含未提交与未跟踪文件）；编辑器临时文件会使副本呈现为"已变更"，与脏状态语义一致。
- 枚举 fail-closed 已在冒烟中覆盖"已注册 worktree 目录丢失"路径；`git worktree list` / `git log --all` 命令本身失败（如对象损坏）依赖同一代码路径抛错，未在冒烟中模拟。
- 权限导致的目录不可读（`EACCES`）会按不可读证据抛错，但在 Windows CI 中难以稳定模拟，未加入冒烟。
