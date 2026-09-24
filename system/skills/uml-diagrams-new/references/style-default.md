# 默认视觉样式

继承旧版 `layout_common.py` 的单色工程图偏好。贴文档时与 `doc-export.md` 一并检查。

| 项 | 值 |
|----|-----|
| 填充 | `#ffffff` |
| 框线 / 连线 | `#333333`，`strokeWidth=2` |
| 文字 | `#000000`，`Microsoft YaHei` |
| 流程边 | 正交、`endArrow=block;endFill=1` |
| 边标签背景 | `#ffffff` |

Mermaid 中可用 `classDef` 预定义；转 draw.io 后可在 XML 中批量替换 style 字符串。

本文件描述**样式**，不是布局。间距与方向见 `layouts/*.json`。
