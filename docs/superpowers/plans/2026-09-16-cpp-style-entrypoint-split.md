# C++ 规范技能命令入口分离 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `cpp-code-style` 与 `cpp-code-style-manager` 的命令脚本彻底分离，同时保持现有用户规则数据可直接读取，无需迁移。

**Architecture:** `cpp-code-style/scripts/style.py` 只提供 effective 规则查询和 C++ 检查；`cpp-code-style-manager/scripts/manage.py` 提供层级、校验、提案、应用和规则生命周期管理。两个技能不互相导入脚本，不新增公共 core；通过现有规则 schema、数据路径约定和共享测试夹具保持数据契约一致。

**Tech Stack:** Python 3.9+, PyYAML, jsonschema, unittest, clang-format（可选测试依赖）

**Spec:** `docs/superpowers/specs/2026-09-16-cpp-style-entrypoint-split-design.md`

## Global Constraints

- 不修改 `rules.yaml`、`details/*.yaml`、`organization.yaml` 的格式、字段、语义和路径。
- 不修改现有规则合并优先级、同 ID 替换和 `overrides` 语义。
- 不执行用户数据迁移、字段重命名、序列化转换、目录迁移或自动重写。
- 不新增第三个公共 core 技能，不让两个技能互相导入 Python 脚本。
- CLI 不保留旧命令兼容；日常技能不暴露管理命令和层级参数。
- 所有生产代码改动遵循先写失败测试、确认失败、再写最小实现的 TDD 顺序。

---

### Task 1: 固定双入口命令边界

**Files:**
- Create: `system/skills/cpp-code-style-manager/scripts/manage.py`
- Modify: `system/skills/cpp-code-style/scripts/style.py:65-101`
- Test: `system/skills/cpp-code-style/tests/test_cli.py`

**Interfaces:**
- `style.py` 对外只接受 `list`、`get`、`check`。
- `manage.py` 对外接受 `list`、`get`、`status`、`validate`、`explain`、`export`、`propose`、`apply`。
- `style.py` 的 `list` 和 `get` 只针对 effective 规则；`manage.py` 的查询支持层级参数。

- [ ] **Step 1: Write the failing boundary tests**

在测试中增加两个入口调用器，并断言入口职责隔离：

```python
def test_style_rejects_management_commands(self):
    result = self.invoke_style("propose", ok=False)
    self.assertNotEqual(result.returncode, 0)

def test_manager_accepts_status_command(self):
    result = self.invoke_manager("status")
    self.assertEqual(result.returncode, 0)
```

- [ ] **Step 2: Run the boundary tests and verify they fail**

```text
python -B -m unittest system.skills.cpp-code-style.tests.test_cli.CLITest.test_style_rejects_management_commands system.skills.cpp-code-style.tests.test_cli.CLITest.test_manager_accepts_status_command
```

Expected: style 仍接受 `propose`，而 manager 入口尚不存在。

- [ ] **Step 3: Implement the two command parsers**

将 `style.py` 的 parser 收窄为 `list`、`get`、`check`。把当前管理命令的 parser 和 dispatch 移入 manager 的 `manage.py`，保留原有管理行为、数据路径和错误语义。

- [ ] **Step 4: Run the boundary tests and verify they pass**

运行同一组测试，确认 style 拒绝管理命令，manager 能执行 `status`。

- [ ] **Step 5: Commit the command-boundary unit**

```text
git add system/skills/cpp-code-style/scripts/style.py system/skills/cpp-code-style-manager/scripts/manage.py system/skills/cpp-code-style/tests/test_cli.py
git commit -m "refactor: split cpp style command entrypoints"
```

### Task 2: 保持日常 style 只读并保留检查能力

**Files:**
- Modify: `system/skills/cpp-code-style/scripts/core.py`
- Modify: `system/skills/cpp-code-style/scripts/handlers.py`
- Modify: `system/skills/cpp-code-style/scripts/style.py`
- Delete: `system/skills/cpp-code-style/scripts/proposals.py`
- Delete: `system/skills/cpp-code-style/scripts/profiles.py`
- Test: `system/skills/cpp-code-style/tests/test_cli.py`

**Interfaces:**
- `style.py list` 返回 `{"rules": [{"id", "summary", "appliesTo"}, ...]}`。
- `style.py get <id>` 返回 effective 规则详情。
- `style.py check <files...>` 保持现有检查状态和退出码。
- style 脚本不写入任何规则层文件。

- [ ] **Step 1: Write the failing read-only tests**

对现有规则层文件做快照，运行 style 的 `list`、`get`、`check`，断言快照不变，并断言 style 不接受 `--layer`、`propose`、`apply`。

- [ ] **Step 2: Run the tests and verify the old implementation fails**

预期：当前 style 仍暴露管理命令或管理参数，因此边界测试失败。

- [ ] **Step 3: Remove management-only style branches**

从 style 入口移除 `status`、`validate`、`explain`、`export`、`propose`、`apply`、profile catalog 和层级参数。保留规则读取、effective 合并、detail 读取、formatter handler 和 check 报告。

- [ ] **Step 4: Run focused tests and verify they pass**

运行 style 的查询、检查和只读测试，确认只读命令不改变规则文件。

- [ ] **Step 5: Commit the daily-skill unit**

```text
git add system/skills/cpp-code-style/scripts system/skills/cpp-code-style/tests/test_cli.py
git commit -m "refactor: keep cpp style entrypoint read-only"
```

### Task 3: 将完整管理实现归入 manager

**Files:**
- Create: `system/skills/cpp-code-style-manager/scripts/core.py`
- Create: `system/skills/cpp-code-style-manager/scripts/handlers.py`
- Create: `system/skills/cpp-code-style-manager/scripts/profiles.py`
- Create: `system/skills/cpp-code-style-manager/scripts/proposals.py`
- Modify: `system/skills/cpp-code-style-manager/scripts/manage.py`
- Test: `system/skills/cpp-code-style/tests/test_cli.py`

**Interfaces:**
- manager 拥有所有规则层写入和完整管理查询。
- manager 读取现有 schema 与数据路径，不改变它们。
- `propose`、`apply`、组织绑定、digest、stale 检查和原子写入保持原有行为。
- manager 的 `list` 可以展示完整层级管理元数据；style 的 `list` 继续保持精简。

- [ ] **Step 1: Route management regression tests through manager**

将初始化、校验、profile、提案、应用、组织和 stale-state 测试改为调用 `invoke_manager`，将日常查询和检查测试改为调用 `invoke_style`。

- [ ] **Step 2: Run the management tests and verify they fail**

预期：manager 脚本尚未实现完整管理逻辑，管理回归测试失败。

- [ ] **Step 3: Implement manager-owned modules**

将现有管理逻辑移入 manager 自己的脚本，保持路径常量、字段语义、schema 校验、proposal digest、stale 检查和写入行为。manager 使用仓库现有的 `cpp-code-style/references/rules.schema.json` 作为数据契约，不修改其内容。

- [ ] **Step 4: Run the management regression tests and verify they pass**

运行完整 CLI 测试，确认 manager 能继续生成相同结构的 `rules.yaml`、detail 文件和 `organization.yaml`。

- [ ] **Step 5: Commit the manager unit**

```text
git add system/skills/cpp-code-style-manager/scripts system/skills/cpp-code-style/tests/test_cli.py
git commit -m "refactor: move rule management into manager skill"
```

### Task 4: 同步技能说明和数据契约

**Files:**
- Modify: `system/skills/cpp-code-style/SKILL.md`
- Modify: `system/skills/cpp-code-style/references/cli.md`
- Modify: `system/skills/cpp-code-style/references/data-contract.md`
- Modify: `system/skills/cpp-code-style-manager/SKILL.md`
- Modify: `system/skills/cpp-code-style-manager/references/initialization.md`
- Modify: `system/skills/cpp-code-style-manager/references/source-normalization.md`
- Modify: `system/skills/cpp-code-style-manager/agents/openai.yaml`

- [ ] **Step 1: Add documentation assertions**

断言日常 skill 的命令说明不再包含管理入口、层级参数和写入流程；manager 文档包含管理入口、层级信息和原有数据路径。

- [ ] **Step 2: Run the assertions and verify they fail**

预期：当前文档仍在 style 中描述部分管理职责，manager 尚未记录新的本地入口。

- [ ] **Step 3: Rewrite the skill instructions**

style 只描述 effective 规则消费、`list`、`get`、`check` 和不可用时转交 manager。manager 承担层级、`enabled`、`overrides`、来源、初始化、提案、写入和数据路径说明。

- [ ] **Step 4: Run documentation checks and the full test suite**

```text
python -B -m unittest discover -s system/skills/cpp-code-style/tests -v
```

Expected: 文档契约和全部测试通过。

- [ ] **Step 5: Commit the documentation unit**

```text
git add system/skills/cpp-code-style/SKILL.md system/skills/cpp-code-style/references system/skills/cpp-code-style-manager/SKILL.md system/skills/cpp-code-style-manager/references system/skills/cpp-code-style-manager/agents/openai.yaml
git commit -m "docs: separate daily and management skill responsibilities"
```

### Task 5: 最终数据兼容性验证

**Files:**
- Modify: `system/skills/cpp-code-style/tests/test_cli.py`

- [ ] **Step 1: Add an existing-data compatibility test**

使用现有 layer fixture 原样初始化隔离的临时用户和项目目录，先由 manager 执行管理操作，再由 style 读取和检查；断言字段集合、文件路径和 detail 结构保持不变。

- [ ] **Step 2: Run the compatibility test and full suite**

```text
python -B -m unittest discover -s system/skills/cpp-code-style/tests -v
```

Expected: compatibility 测试和全部测试以退出码 0 通过。

- [ ] **Step 3: Check the final diff and repository state**

```text
git diff --check
git status --short
git diff --stat
```

确认只有脚本、测试、文档和设计/计划文件改变，没有用户数据目录或规则 fixture 格式变化。

- [ ] **Step 4: Commit the verification unit**

```text
git add system/skills/cpp-code-style/tests/test_cli.py
git commit -m "test: verify cpp rule data compatibility"
```
