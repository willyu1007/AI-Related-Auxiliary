# 状态机图

- Mermaid：`stateDiagram-v2`
- 布局 preset：通常不需二次 layout

## 语义

> 修改边界见 [SKILL.md](../SKILL.md)「三层与修改边界」：本节改状态名/转换条件；**增删状态、拆图、改主路径拓扑**回布局层改 `.mmd` 并重跑转换。

- 开始：`[*] --> 初始状态`
- 终态：`--> [*]` 或显式「结束」状态
- **「关机」是工作状态，不是终态**
- 转换：`状态A --> 状态B : 事件/条件`
- 一步一状态

## 布局

- Mermaid 转换后一般不需 `--layout`
- 状态多、交叉多：Ungroup 后手移或**拆图**

## 样式

| 项 | 值 |
|----|-----|
| 填充 / 框线 / 连线 | `#ffffff` / `#333333`，`strokeWidth=2` |
| 文字 | `#000000`，Microsoft YaHei，`fontSize≥14` |
| 边 | `rounded=0;endArrow=block;endFill=1` |
| 边标签 | `labelBackgroundColor=#ffffff` |
| 起止 | 文字扁圆（与流程图一致）；不用实心黑点 |

## 转换后

- 起止符未呈扁圆时在 draw.io 中改 shape
- 标签避免压在状态框上：offset 或略移状态

## 贴进文档（可选）

**仅当用户明确图将嵌入 Word/PDF 等时执行本节。**

### 导出

```powershell
$drawio = & powershell -NoProfile -File scripts/find-drawio.ps1
& $drawio -x -f png -e -b 10 -s 3 --crop -o name.drawio.png name.drawio
```

画布 **700–1200 px** 宽。状态 **>10** 时优先拆图或合并状态。

### 贴文档前 QA

1. 宽高比是否适合一页（竖长时改图拆图）
2. 起止符、标签、线宽符合样式节
3. Word 显示尺寸下字可读
