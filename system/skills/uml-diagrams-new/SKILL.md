---
name: uml-diagrams-new
description: 生成和验收可编辑 draw.io UML 图。保留 Mermaid 语义源，转换前按图类型选择布局，适配最终尺寸，并通过真实 SVG 几何检查发现文字、节点和连线遮挡。
---

# UML 图生成与验收

基于 [jgraph/drawio-mcp](https://github.com/jgraph/drawio-mcp) 的 CLI 工作流。读取 `upstream/SKILL.md` 和下表对应类型 reference；本文件规定生成与验收顺序。

## 执行顺序

1. 确认图类型、语义及最终用途。**生成前判断是否有尺寸要求**：纸张方向、版心/放置宽度、可用高度、最小实际字号；屏幕图则确认显示区域和像素限制。无尺寸约束时以清楚、紧凑为目标，不强制固定画布宽度。
2. 编写或修改 `.mmd` 语义源，选择方向与分组。运行渲染入口；它先合并 `generation/<类型>.json`，再执行一次 Mermaid→draw.io 转换，随后统一样式、导出 SVG 并检查几何。
3. 对照类型 reference 检查 UML 语义、箭头和端口。**Ungroup 不是默认步骤**；仅实际组合妨碍局部操作时取消组合，并检查父子关系。文件 CLI 导入可以直接产生独立元素。
4. 根据报告修复遮挡：先调整间距、标签 offset、端口或路由；必要时明确选用 `layouts/*.json` 对现有 draw.io 修复布局。涉及拆图、参与者/步骤变化时回 `.mmd`，重新生成。每次改动后重新导出 SVG，重新测量。
5. 有尺寸约束时，执行 [尺寸适配与几何验收](references/size-and-geometry.md)。先裁空白、评估等比放置，再调整方向、间距、换行、分栏/折返；仍放不下时按语义拆图。保留全部语义和跨图接续。
6. **最后一次样式、尺寸、位置或路由改动后**再次检查几何，再目视复核实际放置尺寸、语义、箭头、生命线。检测通过后才导出交付 PNG；检测失败的 draw.io、SVG 和报告保留用于修复。

```powershell
& scripts/render-diagram.ps1 -InputPath name.mmd -DiagramType flowchart -DocExport
```

默认生成 `name.drawio`、`name.drawio.svg`、`name.drawio.geometry.json`；`-DocExport` 仅在几何通过时生成 PNG。已有 `.drawio` 默认输出 `.checked.drawio`，保留输入。可以指定 `-OutputDrawio`、`-GeometryReport`、`-GeometryPreview`、`-BrowserExecutable`；输出路径必须不同于输入。

## 修改边界

| 层 | 产物与操作 |
|---|---|
| 语义 | `.mmd` 维护节点、关系、文字、条件、参与者顺序；拆分或结构变化必须同步语义源 |
| 生成布局 | `generation/*.json` 在转换前选择 ELK 或时序专用布局；方向/分组写入 `.mmd` |
| 成品修复 | `.drawio` 调节点位置、端口、标签 offset、路由、样式；允许布局工具和几何工具计算坐标 |

不通过删节点、删关系、藏文字、合并不同含义步骤或压小字号凑尺寸。成品修复不能代替语义源更新。几何检查器第一版只检测和标记，不自动重建整图。

## 类型入口

| 图类 / DiagramType | 类型 reference | 生成时配置 | 可选成品修复配置 |
|---|---|---|---|
| 流程 / flowchart | [flowchart](references/flowchart.md) | [flowchart.json](generation/flowchart.json)：ELK | `layouts/flowchart-default.json` |
| 类 / class | [class](references/class-diagram.md) | [class.json](generation/class.json)：ELK | `layouts/class-default.json` |
| 时序 / sequence | [sequence](references/sequence-diagram.md) | [sequence.json](generation/sequence.json)：专用布局 | `layouts/sequence-default.json`，只处理平行消息边 |
| 状态 / state-machine | [state](references/state-machine.md) | [state-machine.json](generation/state-machine.json)：ELK | `layouts/state-machine-default.json` |
| 结构 / structure | [structure](references/structure.md) | [structure.json](generation/structure.json)：ELK | `layouts/structure-default.json`、`layouts/graph-horizontal.json` |

生成配置与 draw.io 修复 JSON 是不同格式，不能混用。时序图不套通用 ELK：参与者顺序和消息时间由专用布局处理。draw.io 可自动回退 Dagre，转换成功只证明配置被请求；没有引擎标记时不能宣称已证明使用 ELK。参见 [官方说明](https://www.drawio.com/docs/manual/mermaid/mermaid-layout-engine/)。当前入口支持 JSON `%%{init: ...}%%`；YAML front-matter 须先转为该格式，遇到不支持的配置显式失败。

## 几何工具

在 skill 根目录准备依赖：

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

已有 Chrome/Edge 可直接用 `-BrowserExecutable` 或检查器 `--browser` 指定路径；不需额外下载浏览器。要求 Node 22+、draw.io 桌面 CLI。测试用 `GEOMETRY_BROWSER` 指定已安装浏览器，然后 `pnpm test`。

```powershell
node scripts/check-diagram-geometry.mjs --drawio name.drawio --svg name.drawio.svg --report report.json --preview marked.svg
```

SVG 须由当前 draw.io 文件用 `-x -f svg -e` 新导出。默认 JSON 写 stdout，无额外文件。可选预览为 **SVG**，带碰撞矩形、规则和 cell ID。检查实际文字使用的本地字体是否可加载（含 tspan）；矩形文字裁切可检测。缺失本地字体、复杂裁切/遮罩/滤镜或被裁切的节点轮廓/路径均返回覆盖缺口。

- `0`：覆盖完整且无几何错误；普通线交叉/共线为警告。
- `1`：有遮挡、文字溢出/裁切等错误。
- `2`：运行失败、源图与 SVG 不匹配或存在覆盖缺口。不能按通过交付。

支持普通边标签、节点/独立文字、UserObject、嵌套容器、类成员及基础时序图。通过浏览器字体加载后的文字矩形和 SVG 实际轮廓/路径检测；曲线轮廓按 0.5 SVG 单位采样，容差 0.5。标签自己的连线、节点自身文字、合法祖先与端点容器排除。矩形、圆角、菱形、椭圆、类 swimlane、生命线头框、cylinder3 有覆盖；未知形状、压缩 XML、多页未拆开的输入等报告缺口。文本与曲线边缘接触仍应结合预览复核，语义和实际字号需人工验收。

算法采用范围与许可见 [third-party/NOTICE.md](third-party/NOTICE.md)。第一版不引入 PlantUML 转换或 antigravity 自动重建。

## 通用样式

| 元素 | 要求 |
|---|---|
| 背景、节点填充 | 白色 `#ffffff` |
| 节点边框、连线 | 深灰 `#333333`，线宽 2 |
| 文字 | 黑色，Microsoft YaHei，图内字号至少 14；最终放置还需符合最小实际字号 |
| 连线标签 | 白底，避开其他文字、非所属线、节点和箭头 |
| 箭头 | 头部落在目标端，方向与语义一致 |

类型例外以对应 reference 为准。示例见 [examples/README.md](examples/README.md)。`.mmd` 和 `.drawio` 是维护资产，PNG 和临时报告不提交。
