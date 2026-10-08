# 时序图

- Mermaid：`sequenceDiagram`
- 可选成品修复 preset：`layouts/sequence-default.json`；仅用于分开重叠的平行消息边，不得重排参与者或生命线

## 语义

> 修改边界见 [SKILL.md](../SKILL.md)「修改边界」：本节改消息/别名/片段；**增删参与者、拆时序图**回布局层改 `.mmd` 并重跑转换。

- 参与者：`participant Alias as 显示名`
- **默认禁用 activation**：不用 `activate`/`deactivate`；消息用 `->>` / `-->>`，不用 `->>+` / `-->>-`
- 目标：**仅顶部参与者名框** + 虚线生命线
- 自调用：`A->>A: 短标签`；长说明用 `Note right of A: …`
- 可选：`autonumber`；`alt`/`opt`/`loop`/`par`

## 布局

- 参与者次序和生命线位置由 Mermaid 源码决定；JSON preset 只分开重叠的平行消息边，不得重排参与者或生命线
- 参与者过密时，先缩短显示名或拆图，再重新转换
- 参与者 **>6** 且需贴文档时，考虑拆成两个时序图

## 样式

| 项 | 值 |
|----|-----|
| 顶栏参与者框 | `#ffffff` 填充，`#333333` 框线，`strokeWidth=2` |
| 生命线 | `endArrow=none;dashed=1;strokeWidth=2;strokeColor=#333333` |
| 消息线 | `endArrow=block;endFill=1;strokeWidth=2;strokeColor=#333333` |
| 回传 | 可用 `dashed=1` |
| 文字 | Microsoft YaHei，`fontSize≥14` |

转换后：生命线实线 → 改为上表虚线样式。

## 转换后

| 问题 | 处理 |
|------|------|
| 顶栏 + 底栏双矩形 | 删源中 activation；转换后删 activation 形 |
| 生命线非虚线 | 改生命线 style（见上表） |
| 自调用文字越过生命线 | 移标签/offset；文字左缘 ≤ 该对象生命线 x |

## 贴进文档（可选）

**仅当用户明确图将嵌入 Word/PDF 等时执行本节。**

### 导出

```powershell
$drawio = & powershell -NoProfile -File scripts/find-drawio.ps1
& $drawio -x -f png -e -b 10 -s 3 --crop -o name.drawio.png name.drawio
```

画布宽度按最终尺寸要求确定。按文档版心宽度估算放置高度：`H_doc = W_doc × 图的高度 / 图的宽度`。消息过多时**优先拆图**，勿靠缩小 Word 宽度。

### 贴文档前 QA

1. 仅顶栏 + 虚线生命线
2. 自调用标签不越过生命线
3. Word 显示尺寸下字可读


生成配置在 `generation/`，本节的 `layouts/` 仅用于明确的成品修复；无需默认取消组合。最终尺寸、横向/竖向拆分与重新测量要求见 [尺寸适配与几何验收](size-and-geometry.md)。
