# 迁移说明

## 状态

- `uml-diagrams-new`：新技能（Mermaid + 官方 draw.io 流水线 + ELK layout 预设）
- `uml-diagrams`：旧技能（JSON + Python 手算布局），**保留作参考**

## 稳定后

1. 删除 `system/skills/uml-diagrams/`
2. 将 `uml-diagrams-new` 重命名为 `uml-diagrams`
3. 更新 `SKILL.md` frontmatter 中 `name: uml-diagrams`
4. 更新根目录 `README.md` 技能表

## 对照

| 旧 | 新 |
|----|-----|
| `*.uml-content.json` | `*.mmd` |
| `workflowlayout.py` 等 | draw.io CLI + `layouts/*.json` |
| 始终 Word QA | 可选 `references/doc-export.md` |
| 自研 SKILL 全文 | `upstream/SKILL.md` + 薄扩展 |
