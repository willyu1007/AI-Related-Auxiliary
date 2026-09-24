# 日常 CLI 参考

## 公共参数

所有子命令之前传入 `--project <项目根>`；默认当前目录。可用 `--user-home <目录>` 指定测试或隔离用的用户主目录。格式检查可用 `--clang-format <可执行文件>` 指定工具。输出为 UTF-8 JSON。

运行入口：

```text
python -B <skill-root>/scripts/style.py --project <项目根> list
```

## 命令

- `list`：返回当前有效规则中可执行项目的 `id`、`summary` 和 `appliesTo`，不读取详情。
- `get <id>`：返回指定有效规则的完整详情，必要时读取 detail。
- `check <项目内明确文件...> [--rule <id>] [--fix]`：检查明确指定的项目文件；`--fix` 只执行已实现且规则允许的自动修复。

`list` 和 `get` 只面向当前有效规则，不接受层级选择或规则写入参数。规则不可用时应转交 `cpp-code-style-manager`。

## 检查结果

`pass` 表示检查通过；`violation` 表示发现问题；`needs-review` 表示待语义审查；`not-executed` 表示能力或依赖未就绪；`error` 表示执行失败。完整检查只有所有结果为 `pass` 时才返回 0。
