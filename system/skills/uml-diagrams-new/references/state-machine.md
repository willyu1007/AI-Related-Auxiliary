# 状态机图

- Mermaid：`stateDiagram-v2`
- 可选成品修复 preset：`layouts/state-machine-default.json`

## 语义

> 修改边界见 [SKILL.md](../SKILL.md)「修改边界」：本节改状态名/转换条件；**增删状态、拆图、改主路径拓扑**回布局层改 `.mmd` 并重跑转换。

- 开始：`[*] --> 初始状态`
- 终态：`--> [*]` 或显式「结束」状态
- **「关机」是工作状态，不是终态**
- 转换：`状态A --> 状态B : 事件/条件`
- 一步一状态

## 布局

- 默认使用自上而下的布局；转换后状态间距或平行边仍不合适时，使用 `state-machine-default.json`
- 贴文档时若图过高，先调整 Mermaid 方向或拆图，再重新转换；不要把多条长连线挤到同一终点

## 样式

| 项 | 值 |
|----|-----|
| 填充 / 框线 / 连线 | `#ffffff` / `#333333`，`strokeWidth=2` |
| 文字 | `#000000`，Microsoft YaHei，`fontSize≥14` |
| 边 | `rounded=0;endArrow=block;endFill=1` |
| 边标签 | `labelBackgroundColor=#ffffff` |
| 起止 | 文字扁圆（与流程图一致）；不用实心黑点 |

## 转换后

- 检查每条箭头从源状态指向目标状态，箭头头部位于目标端；不能只凭 Mermaid 源码判断转换结果正确
- 多条结束边汇入同一终点时，检查箭头头部没有相互遮挡、落在状态框边缘或指向错误状态
- 起止符未呈扁圆时在 draw.io 中改 shape
- 标签避免压在状态框上：调整标签或节点位置

## 贴进文档（可选）

**仅当用户明确图将嵌入 Word/PDF 等时执行本节。**

### 导出

```powershell
$drawio = & powershell -NoProfile -File scripts/find-drawio.ps1
& $drawio -x -f png -e -b 10 -s 3 --crop -o name.drawio.png name.drawio
```

画布宽度按最终尺寸要求确定。按文档版心宽度估算放置高度：`H_doc = W_doc × 图的高度 / 图的宽度`。若超出可用页面高度，先评估 `TB`/`LR` 方向、间距或拆图，再检查箭头。状态 **>10** 时优先拆图，保留全部状态和转换。

### 贴文档前 QA

1. 宽高比是否适合一页（竖长时改图拆图）
2. 起止符、标签、线宽符合样式节
3. Word 显示尺寸下字可读


生成配置在 `generation/`，本节的 `layouts/` 仅用于明确的成品修复；无需默认取消组合。最终尺寸、横向/竖向拆分与重新测量要求见 [尺寸适配与几何验收](size-and-geometry.md)。
