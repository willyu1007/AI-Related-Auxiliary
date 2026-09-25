---
name: cpp-code-style
description: Use when writing, reviewing, formatting, or checking C++ code against confirmed rules.
---

# C++ 日常代码规范

本技能负责基于已确认规则进行日常 C++ 编写、审查、格式化和检查。规则的初始化、调整和其它生命周期管理交由 sibling `cpp-code-style-manager` 处理。

## 日常流程

1. 解析用户明确指定的项目根目录。
2. 使用 `python -B <skill-root>/scripts/style.py --project <项目根> list` 查询当前有效规则。
3. 根据涉及的文件、类型、字段、函数和注释，使用 `get` 读取适用规则的完整详情。
4. 只对用户明确指定的项目文件执行 `check` 或支持的格式化处理。
5. 如果规则不可用或配置不完整，停止依赖规范的审查并转交 `cpp-code-style-manager`。

## 查询与审查边界

`list` 只返回当前有效规则的 `id`、`summary` 和 `appliesTo`，不读取详情。不能凭摘要改写代码；复杂规则必须通过 `get` 加载详情后再进行语义判断。

当前已实现的自动能力包括 clang-format 和 UTF-8 无 BOM 检查。命名、类型识别、注释语义等内容仍由审查者根据规则详情阅读源码完成。不得把待审查或未执行结果当作通过，也不得虚构 AST 检查器、工具结果或编译上下文。

本技能不修改规则数据，不自动格式化整个仓库，不重命名符号，不构建 C++，也不学习或导入新的规则来源。
