---
name: cpp-code-style-manager
description: Use when initializing or maintaining confirmed C++ rule data across system, user, organization, and project scopes.
---

# C++ 规范管理

本技能负责 C++ 规则数据的初始化、发现、导入、学习、组织绑定、升级、修改、启用、禁用和删除。日常 C++ 编写、审查和检查由 sibling `cpp-code-style` 处理。

## 管理入口

使用本技能目录下的管理入口：

```text
python -B <skill-root>/scripts/manage.py --project <项目根> status
```

管理入口提供：

- `status`：查看各规则层初始化状态和 profile 升级提示；
- `list`、`get`：查看指定层级或 effective 规则的完整管理元数据；
- `validate`：校验规则、详情、覆盖关系和格式配置；
- `explain`：查看规则来源、覆盖链和处理器就绪状态；
- `export`：导出有效格式配置；
- `propose`、`apply`：生成并应用经审阅确认的规则变更。

## 层级与合并

规则优先级为项目 > 组织 > 用户 > 系统。

- 相同 ID：高层完整替换低层规则。
- 不同 ID：默认同时生效。
- 只有显式 `overrides` 才表示局部覆盖关系。
- 组织层是政策层，压过用户层的同 ID 规则；项目层可以提供仓库级例外。
- 不能仅凭 `summary`、`appliesTo` 或自然语言相似判断覆盖或冲突。

`enabled: false` 表示禁用当前层规则；`--unset` 表示删除当前层覆盖并恢复继承，两者不能混淆。

## 数据与写入

现有数据路径保持不变：

```text
<用户主目录>/.agents/skill-data/cpp-code-style/
<项目根>/.agents/skill-data/cpp-code-style/
```

系统、用户、组织和项目层分别保存自己的 `rules.yaml`。组织绑定保存在项目的 `organization.yaml`，组织缓存保存在用户目录。已有 `rules.yaml`、`details/*.yaml` 和 `organization.yaml` 不需要迁移。

正常流程禁止手工编辑规则数据。变更必须经过 `propose`、完整 diff、目标层确认和 `apply --confirm <digest>`。提案过期或数据无效时停止并重新校验，不覆盖已有数据。

规则应拆分为单一意图、清晰对象和明确范围的细粒度规则。来源、例外、示例和覆盖理由应保存在相应管理数据中，不应通过宽泛摘要隐藏多个要求。

初始化、来源归一化和数据契约细节见：

- [初始化参考](references/initialization.md)
- [来源归一化](references/source-normalization.md)
- [CLI 参考](references/cli.md)
- [数据契约](references/data-contract.md)
