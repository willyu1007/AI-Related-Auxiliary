# 管理 CLI 参考

## 公共参数

所有子命令之前传入 `--project <项目根>`；默认当前目录。可用 `--user-home <目录>` 隔离测试用户目录；`--clang-format <可执行文件>` 指定格式化工具。CLI 要求 Python 3.9+，输出为 UTF-8 JSON。

入口：

```text
python -B <skill-root>/scripts/manage.py --project <项目根> status
```

## 命令

- `status [--catalog <index.yaml>]`：报告 system/user/organization/project 的 `missing`、`empty`、`valid`、`invalid` 状态和初始化路径；项目未绑定组织时为 `unbound`。
- `list [--layer effective|system|user|organization|project]`：返回管理元数据，不读取详情。
- `get <id> [--layer ...]`：返回完整规则，按需读取详情。
- `explain <id>`：返回覆盖链、当前来源和 handler 就绪情况。
- `validate`：校验所有启用层、详情、规则配置和覆盖关系。
- `export`：返回有效合并配置和工具信息，不写文件。
- `propose --layer system|user|organization|project --input-file <rules.yaml> [--unset <id>] [--base-style Google] [--with-format] [--proposal-file <提案.json>] [--summary|--diff|--quiet]`：生成提案，不写规则。
- `apply --proposal-file <提案.json> --confirm <digest> [--verbose] [--quiet]`：应用已经审阅确认的提案。

`apply` 是唯一直接写入规则数据的命令。设置 `enabled:false` 表示禁用；`--unset` 表示恢复继承。所有提案均要求目标层确认，并在数据或提案过期时拒绝执行。

## 行为边界

管理入口不自动访问网络、不构建 C++、不递归格式化仓库。组织规则、系统 profile、用户偏好和项目规则必须按对应层级写入；组织绑定由项目 `organization.yaml` 中的 `id` 与 `revision` 指定。

## 验证

在维护仓库根运行：

```text
python -B -m unittest discover -s system/skills/cpp-code-style/tests -v
```

