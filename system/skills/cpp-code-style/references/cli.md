# CLI 参考

## 公共参数

所有子命令之前传入 `--project <项目根>`；默认当前目录。`--user-home` 默认当前用户主目录，可用于隔离测试。`--clang-format` 可指定可执行文件。输出为 UTF-8 JSON。

## 命令

- `status [--catalog <index.yaml>]`：只读报告 system/user/project 的 `missing`、`empty`、`valid`、`invalid` 状态和初始化路径；带 catalog 时额外报告 bundled profile 升级提示。
- `list [--layer effective|system|user|project]`：只返回规则元数据，不读取详情。
- `get <id> [--layer ...]`：返回完整规则，按需读取详情。
- `explain <id>`：返回覆盖链、当前来源和 handler 就绪情况。
- `validate`：校验所有存在层、详情、规则配置和完整三层的 scoped override/格式冲突；不是 C++ 代码检查。
- `export`：返回有效合并配置和工具信息，不写文件；要求三层已初始化。
- `propose --layer system|user|project --input <rules.yaml> [--unset <id>] [--base-style Google] [--with-format] [--out <提案.json>]`：生成提案，不写规则。
- `apply --proposal <提案.json> --confirm <digest>`：仅应用用户已审查并确认的提案。
- `check <项目内明确文件...> [--rule <id>] [--fix]`：要求三层已初始化，只检查明确文件。

`propose` 的 system 输入必须含 `profile` 和 `baseStyle`；user/project 输入不得含 `profile`。`--input` 可含多条规则，详情相对输入索引解析后复制到目标层。`--unset` 可重复。`--with-format` 将当前项目 `.clang-format` 的完整差异纳入提案；目标即使无内容差异也纳入过期检查。

`status`、`list`、`get`、`explain`、`validate`、`propose` 不修改规则层；`--out` 只保存供审阅的提案 JSON。`apply` 是唯一的规则写入命令，并要求 digest 与提案内容完全一致。设置 `enabled:false` 是禁用；`--unset` 是恢复继承，两者不同。

## 行为边界

check 不递归枚举仓库、不检查外部引擎、不调用构建。`--fix` 只执行已实现且规则允许的自动修复，独立于规则学习授权。格式检查使用最终配置而非可能过期的硬盘 `.clang-format`。语义规则对所选文件返回待审查；不得把 `needs-review` 当作通过。

## PowerShell 示例

```powershell
python -B <skill>/scripts/style.py --project D:/work/Example status
python -B <skill>/scripts/style.py --project D:/work/Example list
python -B <skill>/scripts/style.py --project D:/work/Example get naming.struct-field
python -B <skill>/scripts/style.py --project D:/work/Example propose --layer project --input <incoming>/rules.yaml --out <review>/proposal.json
# 展示提案并等待用户确认层级和内容后，使用提案中的完整 digest
python -B <skill>/scripts/style.py --project D:/work/Example apply --proposal <review>/proposal.json --confirm <digest>
```

## 验证

在维护仓库根运行：

`python -B -m unittest discover -s cpp-code-style/tests -v`

测试使用临时用户/项目目录；没有 clang-format 时真实格式测试可以 skip，其余测试照常执行。
