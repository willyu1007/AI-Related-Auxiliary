# Task 治理第三轮实施质量复审

日期：2026-08-20

审查对象：第三轮重写后的 `task-governance-review-implementation.md` 及其对应未提交实现

范围：7 个 task/project skill、task-start 治理脚本与资产、`checks/skills/task-start.sh`

## 结论

第三轮已经解决上一版 findings 的五项问题：

- 完整 bundle freshness 已覆盖 roadmap、architecture、verification 和 supporting documents；
- 非查询文档并发分歧会 fail-closed；
- prune 已改为按稳定 Task ID 检查本地 branch tip；
- stale worktree 的 local-only sync 边界已传播到 skill、AGENTS 和 CLI help；
- keywords 测试已覆盖 3–8 个数量契约，验证记录也注明了 POSIX shell 前提。

当前实现仍不建议标记为最终完成。剩余一个高优先级证据入口问题会绕过上述新机制；prune 的 branch metadata 校验和 `documents` 冲突诊断也尚未达到精确、可操作的质量。

## 高优先级问题

### 1. Git worktree 与 branch-history 枚举仍然 fail-open

相关位置：

- `system/skills/task-start/assets/project/.ai/scripts/lib/governance-read.mjs:217`
- `system/skills/task-start/assets/project/.ai/scripts/lib/governance-read.mjs:1090`
- `system/skills/task-start/assets/project/.ai/scripts/lib/governance-read.mjs:1132`
- `task-governance-review-implementation.md:76`

第三轮对已发现 occurrence 的 bundle digest、merge-base 和 prune branch-tip evidence 做了 fail-closed 处理，但更上游的 evidence 枚举仍会把失败解释为空：

- `listGitWorktrees()` 在 `git worktree list --porcelain` 返回 null 或空内容时，退化为“只有当前 worktree”；
- `taskIdsFromAllBranches()` 在 `git log --all` 返回 null 或空内容时，返回空 ID 集合；
- `listImmediateChildDirs()` 捕获任意目录读取异常后返回空数组，无法区分“确实没有 dev-docs”与“linked worktree 或目录不可读”。

这会导致：

- query/dedupe 静默遗漏其他 worktree；
- resume 选择错误 occurrence；
- sync 遗漏未提交或历史 Task ID，可能重复分配 ID；
- prune 漏掉不可访问 worktree 中的未提交 bundle；
- unsupported-layout guard 只检查当前可见部分。

该行为与实施记录“所有 `null` 证据一律拒绝解析/拒绝删除”的声明不一致。底层 digest 的 fail-closed 无法弥补 occurrence 在进入算法前已经被遗漏。

建议：

1. 让 worktree/branch 枚举返回明确的 `{ok, value, error}`，或在不可读时抛出可识别错误；不要用当前 worktree 或空集合兜底。
2. 区分合法空状态与命令失败：unborn repository 可以没有 branch history，但 Git 命令失败不能等价为空。
3. linked worktree 根目录不存在或不可访问时停止跨-worktree query/write；仅当 worktree 根存在且确实尚未安装 dev-docs 时，才允许把它视为无 task evidence。
4. 为 query、resume、sync allocation 和 prune 增加 evidence-enumeration 失败测试，并验证所有写路径零写入。

## 中优先级问题

### 2. prune 的 branch metadata 只做 JSON 解析，没有验证精确 schema

相关位置：

- `system/skills/task-start/assets/project/.ai/scripts/lib/governance-write.mjs:169`
- `system/skills/task-start/assets/project/.ai/scripts/lib/governance-write.mjs:194`
- `checks/skills/task-start.sh:1166`

`findTaskBranchTips()` 直接执行 `JSON.parse(blobRaw)` 并读取 `task_id`，没有复用 `parseTaskMeta()`，也没有核对 metadata slug 与 bundle 目录 slug。

因此以下 branch-tip evidence 不会统一进入 unverifiable：

- 错误或缺失的 metadata version；
- 额外的 lifecycle/legacy 字段；
- 非规范 Task ID；
- keywords schema 错误；
- metadata slug 与目录 slug 不一致。

危险边界是：一个实际属于 T-ID、但 `task_id` 格式已经损坏的 bundle 可能无法匹配目标 ID，同时又不会让 prune fail-closed。

当前 rename smoke 也只执行了 `git mv`，没有同步 `.ai-task.json.slug`，因此提交的是 slug/path 不一致的无效 bundle。该测试证明了路径无关查找，却没有证明合法 renamed bundle 与非法 metadata 的边界。

建议：

1. 对 branch-tip metadata 执行精确 schema 校验，并核对 metadata slug 与路径中的 slug。
2. 目标 Task 的证据非法或无法可靠归属时拒绝 prune；不要把 schema drift 当作“不存在”。
3. 将 rename fixture 更新为合法 metadata，再分别增加 malformed JSON、schema-invalid metadata 和 slug mismatch 的拒绝测试。

### 3. 合成的 `documents` 冲突没有提供可操作证据

相关位置：

- `system/skills/task-start/assets/project/.ai/scripts/lib/governance-read.mjs:912`
- `system/skills/task-start/assets/project/.ai/scripts/lib/governance-read.mjs:916`
- `system/skills/task-resume/SKILL.md:26`

当完整 bundle 无法解析为单一线性演进、但查询字段相同时，当前输出只有：

```text
field: documents
value: divergent-or-unverifiable-content
```

所有 worktree 被放进同一个 value，且并发内容分歧与 Git/I/O evidence 不可读使用同一原因。该结构能够阻止写操作，但无法让 LLM 判断：

- 哪些 worktree 内容等价；
- 哪个 worktree 读取失败；
- 下一步应协调并发文档，还是修复 Git/evidence 环境。

这与 `conflicts` 应保留差异证据、恢复流程应给出明确下一动作的目标不完全一致。

建议在保持 bounded output 的前提下：

- 用明确 reason 区分 `concurrent-divergence`、`unrelated-history`、`missing-lineage` 与 `unreadable-evidence`；
- 对可读内容按 digest 等价组列出 worktree；
- 对不可读 evidence 指出 worktree、路径和失败阶段，不必输出文档内容。

## 低优先级问题

### 4. bundle digest 的文件列表通过单次命令行传递

相关位置：

- `system/skills/task-start/assets/project/.ai/scripts/lib/governance-read.mjs:673`
- `system/skills/task-start/assets/project/.ai/scripts/lib/governance-read.mjs:678`

`worktreeBundleDigest()` 把 bundle 下所有路径一次性传给 `git hash-object`。`artifacts/` 允许保存较多证据文件，在 Windows 上可能达到命令行长度限制。当前行为会安全地返回 null 并形成 conflict，不会错误写入，但 query/resume 会因此失去可用性。

建议使用 `git hash-object --stdin-paths`，或采用有界批次并保持路径与 object ID 的确定性映射。

### 5. 实施记录的复审总账数量不一致

相关位置：

- `task-governance-review-implementation.md:19`

文档称第一轮复审提出 10 项，但括号只列出 8 项，上一版 findings 也只有 8 个编号；随后“确认其余问题并新增 5 项”的数量关系同样无法由表格复原。

建议按每轮实际编号重写一句总账，或删除容易漂移的总数，只保留逐项处置表。

### 6. “编辑文件 linter”验证项不可复现

相关位置：

- `task-governance-review-implementation.md:61`

该检查没有工具名、命令或覆盖范围。若它只是编辑器诊断，不应与可复现的仓库验收并列；若确有 linter，应记录准确命令。

## 已确认解决的问题

| 上一版 finding | 当前结果 |
|---|---|
| 查询字段相同时忽略 roadmap/architecture/verification 演进 | 已对所有多 occurrence 行计算完整 bundle digest；线性演进能路由到最新 worktree |
| 非查询文档并发时仍选择当前 worktree | 已合成 `documents` conflict 并阻止 sync；诊断质量仍见中优先级问题 3 |
| prune 按旧 registry 路径/slug 判断 branch evidence | 已改为扫描本地 branch tip 中的 `.ai-task.json.task_id` |
| stale sync 语义未传播 | task-start、task-sync、AGENTS 和 CLI help 已统一 local-only checkpoint 边界 |
| keywords fixture 只有两个关键词 | 已改为三个并断言 3–8 范围及 query 命中 |
| 验证记录缺少 POSIX shell 前提 | 已记录 Windows 下 Git Bash `sh` 的 PATH 前提 |

## 验证结果

| 检查 | 当前结果 |
|---|---|
| 7 个相关 skill 的 quick validation | 通过 |
| 全部治理 `.mjs` 的 `node --check` | 通过 |
| static 布局、引用和文档检查 | 通过 |
| task-start 完整 smoke | 在 Git Bash `sh` 可发现时通过 |
| `git diff --check` | 通过，仅有 checkout EOL 提示 |

现有 smoke 已覆盖完整 bundle linear/stale/co-leader/concurrent、document-only evolution、Task ID branch prune、map、resume、keywords 和 archive。它尚未覆盖本次发现的 evidence-enumeration 失败、branch metadata schema drift，以及大量 artifacts 路径。

## 推荐修复顺序

1. 修复 `listGitWorktrees`、`taskIdsFromAllBranches` 和 linked worktree 目录读取的 fail-open 行为。
2. 增加 Git/worktree evidence 不可读时 query、resume、sync、prune 的零写入测试。
3. 让 branch-tip prune 使用精确 metadata schema 和 slug/path 一致性检查。
4. 修正 rename fixture，并补 malformed/schema-invalid metadata 测试。
5. 细化 `documents` conflict 的 reason 和等价组证据。
6. 将 bundle 文件 hashing 改为不受命令行长度限制的输入方式。
7. 校正实施记录的数量总账和不可复现验证项。

## 验收标准

只有同时满足以下条件，才建议将第三轮实施记录标记为最终完成：

- 任何 worktree、branch-history 或 task-root evidence 不可读时都不会退化为“空”或“只有当前 worktree”；
- query/dedupe、resume、allocation 和 prune 在 evidence 枚举失败时全部 fail-closed；
- branch-tip Task evidence 按唯一精确 metadata schema 解释，slug/path 漂移不会形成隐式兼容路径；
- `documents` conflict 能区分并发、无谱系和不可读 evidence，并给出可操作的 bounded 诊断；
- 大量 artifacts 路径不会因 Windows 命令行长度限制使任务无法查询或恢复；
- 实施记录、skill、AGENTS、CLI help、代码和持久测试描述同一套行为；
- 完整 runner、7 个 quick validation、治理脚本 `node --check` 和 `git diff --check` 全部通过。
