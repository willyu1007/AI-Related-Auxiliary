# CLI 参考

## 公共参数

所有子命令之前传入 `--project <项目根>`；默认当前目录。`--user-home` 默认当前用户主目录，可用于隔离测试。`--clang-format` 可指定可执行文件。CLI 要求 Python 3.9+，不锁定小版本；依赖见同目录 `requirements.txt`。输出为 UTF-8 JSON。

## 命令

- `status [--catalog <index.yaml>]`：只读报告 system/user/project 的 `missing`、`empty`、`valid`、`invalid` 状态和初始化路径；带 catalog 时额外报告 bundled profile 升级提示。
- `list [--layer effective|system|user|project]`：只返回规则元数据，不读取详情。
- `get <id> [--layer ...]`：返回完整规则，按需读取详情。
- `explain <id>`：返回覆盖链、当前来源和 handler 就绪情况。
- `validate`：校验所有存在层、详情、规则配置和完整三层的 scoped override/格式冲突；不是 C++ 代码检查。
- `export`：返回有效合并配置和工具信息，不写文件；要求三层已初始化。
- `propose --layer system|user|project --input-file <rules.yaml> [--unset <id>] [--base-style Google] [--with-format] [--proposal-file <提案.json>] [--summary|--diff|--quiet]`：生成提案，不写规则；`--input`、`--out` 仍是兼容别名。
- `apply --proposal-file <提案.json> --confirm <digest> [--verbose] [--quiet]`：仅应用用户已审查并确认的提案；`--proposal` 是兼容别名。
- `check <项目内明确文件...> [--rule <id>|format] [--fix]`：要求三层已初始化，只检查明确文件；`format` 是所有启用 clang-format 规则的规则组。

`propose` 的 system 输入必须含 `profile` 和 `baseStyle`；user/project 输入不得含 `profile`。`--input` 可含多条规则，详情相对输入索引解析后复制到目标层。`--unset` 可重复。`--with-format` 将当前项目 `.clang-format` 的完整差异纳入提案；目标即使无内容差异也纳入过期检查。

`status`、`list`、`get`、`explain`、`validate`、`propose` 不修改规则层；`--out` 只保存供审阅的提案 JSON。`apply` 是唯一的规则写入命令，并要求 digest 与提案内容完全一致。设置 `enabled:false` 是禁用；`--unset` 是恢复继承，两者不同。

`propose` 默认只在标准输出返回摘要：目标层、触及的规则 ID、写入路径、create/update/delete、diff 增删统计、影响范围和 digest。`--diff` 额外返回完整 unified diff；`--quiet` 不输出标准输出，但必须配合 `--proposal-file` 保存完整提案。完整提案文件仍包含 apply 所需的 before/after 内容，不因摘要模式改变 digest。

`apply --verbose` 将 `load proposal`、`proposal digest validated`、`preflight`、每个目标的 `write start/write complete` 和最终完成状态写入 stderr，不污染 JSON stdout。写入错误包含操作、目标路径、异常类型和系统错误；文件系统调用不引入后台超时线程或新的回滚机制。

digest 错误会区分缺少确认、确认值不匹配和提案文件被修改；stale 错误会指出 rules、detail、schema、`.clang-format` 或目标文件 hash 的变化。项目/用户不匹配和非法层级也单独报告。

## 行为边界

check 不递归枚举仓库、不检查外部引擎、不调用构建。`--fix` 只执行已实现且规则允许的自动修复，独立于规则学习授权。格式检查使用最终配置而非可能过期的硬盘 `.clang-format`。语义规则对所选文件返回待审查；不得把 `needs-review` 当作通过。结果保留逐条 `results`，并附带 `automated.passed/failed/notExecuted`、`semantic.needsReview/pending/ruleCount` 和 `complete`，便于区分自动检查失败与人工审查待办。

## PowerShell 示例

```powershell
python -B <skill-root>/scripts/style.py --project D:/work/Example status
python -B <skill-root>/scripts/style.py --project D:/work/Example list
python -B <skill-root>/scripts/style.py --project D:/work/Example get naming.struct-field
python -B <skill-root>/scripts/style.py --project D:/work/Example propose --layer project --input-file <incoming>/rules.yaml --proposal-file <review>/proposal.json
# 展示摘要或使用 --diff 查看完整差异，等待用户确认层级和内容后，使用提案中的完整 digest
python -B <skill-root>/scripts/style.py --project D:/work/Example apply --proposal-file <review>/proposal.json --confirm <digest> --verbose
```

## 验证

在维护仓库根运行：

`python -B -m unittest discover -s cpp-code-style/tests -v`

测试使用临时用户/项目目录；没有 clang-format 时真实格式测试可以 skip，其余测试照常执行。
