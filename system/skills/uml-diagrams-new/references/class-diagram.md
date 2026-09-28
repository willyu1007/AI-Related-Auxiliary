# 类图

- Mermaid：`classDiagram`
- 布局 preset：[class-default.json](../layouts/class-default.json)

## 语义

> 修改边界见 [SKILL.md](../SKILL.md)「三层与修改边界」：本节改文案/可见性/关系类型；**增删类、改继承拓扑、拆图**回布局层改 `.mmd` 并重跑转换。

- 类名 / 属性 / 操作分栏；一步一类
- **可见性（draw.io 原样渲染）**：
  - `+` 公开（**默认**）
  - `-` 私有
  - `#` **仅** protected；不得作装饰或占位
  - `~` 包内
- 推荐花括号写法：

  ```mermaid
  classDiagram
    class Example {
      +String name
      +operation()
    }
  ```

- 关系：`<|--` 继承、`*--` 组合、`..>` 依赖

## 布局

- 关联线偏短、类框过密：Ungroup 后 `class-default.json`
- 仍不够：手移类框或增大 preset 中 `elk.spacing.nodeNode`

## 样式

| 项 | 值 |
|----|-----|
| 填充 / 框线 / 连线 | `#ffffff` / `#333333`，`strokeWidth=2` |
| 文字 | `#000000`，Microsoft YaHei，框内 `fontSize≥14` |
| 边 | `endArrow=block;endFill=1`（继承可用 `endFill=0`） |
| 边标签 | `labelBackgroundColor=#ffffff` |

可见性符号**只改 `.mmd`**，不在 style 层批量替换 `#`/`+`。

## 转换后

| 问题 | 处理 |
|------|------|
| 属性前出现 `#` | 源里误写 protected → 公开成员改 `+` |
| 连线偏短 | `class-default.json` + MCP 拉大类间距 |

## 贴进文档（可选）

**仅当用户明确图将嵌入 Word/PDF 等时执行本节。**

### 导出

```powershell
$drawio = & powershell -NoProfile -File scripts/find-drawio.ps1
& $drawio -x -f png -e -b 10 -s 3 --crop -o name.drawio.png name.drawio
```

画布宽度 **700–1200 px**；Fit Page to Content。类图通常宽高比适中；类过多时**优先拆图**或减类数。

### 贴文档前 QA

1. 框内文字不溢出；关联线可辨认
2. 公开成员为 `+`，无多余 `#`
3. Word 显示尺寸下字可读
