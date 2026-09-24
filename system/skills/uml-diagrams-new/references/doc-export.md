# 文档贴图导出（可选）

**启用条件**：用户明确说图将嵌入 Word、PDF 说明书、钉钉文档等。未声明时不要执行本页约束。

## 目标

印进文档后仍清晰可读：线不消失、字不贴边、画布不过宽导致被缩小。

## 导出命令

在已有 `.drawio` 上（先完成 upstream 流水线中的 convert/layout）：

```powershell
$drawio = & powershell -NoProfile -File scripts/find-drawio.ps1
& $drawio -x -f png -e -b 10 -s 3 --crop -o name.drawio.png name.drawio
```

GPU 失败时加 `--disable-gpu`。

## 画布与尺寸

- 目标画布宽度约 **700–1200 px**（Word 版心约 146 mm，过宽会被压细）
- `pageWidth` / `pageHeight` 应贴近内容外框；导出前可在 draw.io 中 **File → Fit Page to Content**
- 提高 `-s` 不能代替加线宽

## 样式下限

与 `style-default.md` 一致，导出前检查：

- 框线、连线 `strokeWidth ≥ 2`，颜色 `#333333`（勿用浅灰）
- 字体 Microsoft YaHei；框内 `fontSize ≥ 14`，边标签 `≥ 13`
- 边标签 `labelBackgroundColor=#FFFFFF`
- 流程/状态：扁圆「开始」「结束」文字起止符；不用实心黑点

## 视觉 QA（贴文档前）

1. 标签是否压在连线上
2. 多条平行边是否可区分
3. 起止符是否为文字扁圆
4. 导出 PNG 在 Word 100% 宽度下是否仍清晰

ELK 或 layout.json 无法满足的汇流/标签位置，用 draw.io 桌面或 MCP 微调后再导出。
