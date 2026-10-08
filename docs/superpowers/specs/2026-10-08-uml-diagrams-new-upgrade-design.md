# uml-diagrams-new 流程与几何验收升级

## Task head

- Slug: `uml-diagrams-new-upgrade`
- State: planned
- Current phase: 正式建档与实施准备。
- Next step: 执行实施计划阶段 1，验证 SVG 渲染测量、元素关联和生成时布局配置。
- Blocker: none
- User approval: 已确认整体流程、尺寸适配规则，以及参考开源实现的第一版几何检测范围。
- Record: 本文件保存范围、设计、验收及决定；对应实施计划保存执行步骤与检查点。
- Tracking: 本仓库是治理资源库，安装器禁止向自身安装 task-governance；沿用已有 `docs/superpowers` 规格与计划结构，不伪造 `T-###` 编号，也不修改该安装限制。

## Goal

升级 `system/skills/uml-diagrams-new`，让图在生成前选择对应布局策略，在交付前完成目标尺寸适配及基于实际渲染几何的检查，稳定发现边标签遮挡，并通过可复现的报告指导修复。

## Confirmed scope

1. 每种支持的图类型有明确布局策略：图结构类型优先在 Mermaid 转换时选择 ELK；时序图使用专用布局。
2. 删除固定的 Ungroup 步骤；根据实际输出结构和操作需要决定是否取消组合。
3. 在生成前读取成品尺寸要求，在最终样式应用后执行尺寸适配；尺寸和可读性同时满足。
4. 第一版几何验收检测标签相互遮挡、标签与其他节点或非所属连线相交、节点遮挡、连线穿框、文字溢出或裁切。
5. 复用有明确来源与许可的开源几何实现；补齐普通边标签、真实文字测量、分组坐标及 UserObject 关联。
6. 提供问题类型、元素 ID、相关文字、位置、严重程度和可选标记预览，接入现有渲染脚本及类型规范。
7. 以用户提供的外部 I/O 图、仓库各图类型示例和少量专项测试验证结果。

本次第一版实现检测和报告；修复使用已有布局、路由、端口与标签调整工具。自动标签优化器、自动拆图器、全图重建修复不属于第一版。用户的现有图作为只读验证输入，不在该项目中复制业务材料或改写原文件。全局已安装 skill 的同步另行处理，源代码修改以本仓库为准。

## Current evidence

- 本机 draw.io Desktop 31.3.2 的 CLI 已实际转换一份外部 I/O Mermaid：成功输出 6 个节点、6 条边，全部位于默认图层，无额外 Mermaid 容器组。
- 用户提供的外部 I/O SVG 中，两个边标签相互遮挡；SVG 带 `data-cell-id`，具备从渲染结果关联 drawio 元素的基础。
- 仓库版本的渲染脚本目前先转换，再可选运行布局 JSON，随后应用样式；尚无几何检测器。
- 仓库当前的时序图 JSON 是平行边调整，并不是 ELK 时序布局，不能当作生成配置。
- draw.io 文档支持在 Mermaid 中指定 ELK，但可能回退至 Dagre；配置存在不能作为实际使用引擎的证明。
- `node checks/run.mjs` 在当前 Windows 环境的行为检查中因读取 `/dev/null` 失败。该基线故障不纳入本任务修复范围；未获得该总检查通过的证据。
- 独立执行现有静态检查还报告两条 `uml-diagrams` 跨 skill 引用及 upstream 文档中的机器路径；均来自建档前已有文件。规格和计划本身的链接、占位符及格式检查已通过。实施阶段需审查本 skill 范围内的检查结果，不能将本轮文档验证说成仓库检查全绿。

## Workflow contract

```text
图类型、内容与成品尺寸要求
  → Mermaid 语义源与类型布局配置
  → 一次 CLI 转换
  → 输出结构检查与最终样式
  → 成品尺寸适配
  → 渲染、几何检测、针对性修复
  → 最终尺寸及可读性复核
  → 交付可编辑图与所需导出
```

`.mmd` 保留为语义源，`.drawio` 为可编辑成品。后续修改字号、换行、节点位置、端口或路径都使之前的几何验收失效，必须重新渲染并检查。

### Generation-time layout

| 图类型 | 策略 |
|---|---|
| 流程／活动 | ELK 分层，默认向下，可按尺寸要求横向展开 |
| 类图 | ELK 图布局，预留关联与多重性标签空间 |
| 状态机 | ELK 图布局，检查回边、自环和起止符 |
| 结构／组件 | ELK 图布局，支持方向与容器 |
| 时序 | Mermaid 专用时序布局，保留参与者顺序、消息先后和片段语义 |

生成配置与 draw.io 转换后布局 JSON 分开维护。参数以本机转换器实测支持为准，不把 draw.io 的 `mxParallelEdgeLayout` 或任意 `elk.*` 配置直接塞入 Mermaid。不宣称无法观测的引擎执行结果。现有二次布局入口只服务明确的重新布局或局部修复。

### Size adaptation

生成前读取用户提供的宽高、页面方向、可用版心、像素或物理尺寸、分辨率和最小可读字号；缺少决定性尺寸时向用户补齐。没有尺寸要求时，不默认套用 Word 尺寸或 700–1200 px 的限制。

适配依次考虑裁空白、可读条件下等比缩放、横竖方向及排布调整、标签换行与间距、分栏或折返，最后沿语义边界拆图。

| 操作 | 定义 |
|---|---|
| 横向／竖向布局 | 主流程或层级从左到右／从上到下展开 |
| 分栏／折返 | 连续内容排成多栏或多行，仍为一张图 |
| 横向拆分 | 图过宽时沿内容结构拆为多张较窄的图 |
| 竖向拆分 | 图过高时沿流程阶段或层级拆为多张较矮的图 |

拆分是重新组织可编辑图，不能切割 PNG。子图有必要上下文、对应接续标识和图题顺序。流程按阶段、结构按模块或层级、时序按交互阶段拆分；保留必要参与者。不能自动删步骤、改变关系或合并不同含义的节点来凑尺寸，也不能非等比拉伸或过度缩小文字。

涉及内容组织的调整回 `.mmd` 再生成；标签、路由、样式和几何位置可在 drawio 层修复。禁止 Agent 凭感觉编造坐标，允许布局器与检测器计算坐标。

## Geometry tool design

### Reuse boundary

| 来源 | 采用内容 | 不继承的局限 |
|---|---|---|
| Sunwood-ai-labs/draw-io-skill | 线段相交、线段穿框、贴边检测的几何函数、容差思路和问题报告 | 不以估算节点文字代替实际边标签测量；不把其全部 lint 规则引入本任务 |
| holdyounger/drawio-diagram-builder | 参考节点遮挡、溢出规则和严重程度组织 | 不把 XML 控制点当作最终渲染路径；不跳过同组兄弟节点的遮挡 |
| antigravity-drawio-mcp | 参考基础碰撞检查的数据流 | 不使用其向下移动节点、重建第一页图的修复方式 |

落地时记录上游提交版本、采用的函数及修改，保留实际复用代码所需的 MIT 许可和版权文本。来源记录放在 skill 自身，随安装分发。

### Data acquisition

CLI 导出 SVG；浏览器加载 SVG，等待字体完成加载，以同一坐标系读取节点轮廓、连线路径和文字的实际边界。文字包括 SVG text 和 HTML foreignObject 内的实际文字内容，不能使用占据整个画布的 foreignObject 外框。

通过 `data-cell-id` 关联 SVG 与 drawio；XML 解析覆盖 mxCell、UserObject 包装、父子关系及相对坐标。容器背景、类图成员、时序生命线和片段框需要结合结构辨别，不能只看矩形尺寸或 ID 名称猜测。

优先沿用仓库 Node ESM 脚本形式，复用现有 PowerShell 导出入口；浏览器测量使用 Playwright。独立 CLI 先作为接入点，避免将检测逻辑塞进渲染脚本。分发所需的依赖与浏览器准备命令须记录，不能把本机的 Codex 缓存路径写入 skill。

### Findings and coverage

| 规则 | 第一版处理 |
|---|---|
| label-label | 不同元素的可见文字区域相交，报告错误 |
| label-node | 文字侵入非所属、非合法祖先节点，报告错误 |
| label-edge | 非所属连线穿过文字，报告错误 |
| node-node | 非合法包含关系的节点实际遮挡，报告错误 |
| edge-node | 连线穿过非端点、非合法容器节点，报告错误 |
| text-overflow / clipping | 自身文字超出可用显示区域或被裁切，报告错误 |
| edge-edge | 普通交叉及通道共线先报告警告，不一律阻断 |

节点文字位于自身节点内、子节点位于祖先容器内、标签覆盖自身连线的小段均为正常关系。时序图中消息与生命线的正常交汇不能套用一般连线交叉错误规则。非矩形节点不能仅靠外接矩形直接判定实际碰撞。

检测报告需明确已测元素和未覆盖元素。缺少字体、元素关联失败、未知形状或页面未处理时，不能以“没有问题”冒充完整验收。每页分别处理并在报告中标明页号；第一版若有无法处理的页或形状，报告覆盖缺口而非静默跳过。

### Proposed CLI contract

```text
node scripts/check-diagram-geometry.mjs --drawio <diagram.drawio> --svg <diagram.drawio.svg>
  [--report <report.json>] [--preview <marked.html>] [--browser <executable-path>]
```

输入只读；默认报告写 stdout，文件和标记预览仅在指定路径时生成。报告包含 `coverage`、页号、元素 ID、规则、严重程度、文字、碰撞位置与依据。退出码：`0` 表示已覆盖范围内无阻断问题，`1` 表示存在几何错误，`2` 表示运行失败或无法完成要求的覆盖；警告不单独产生 `1`。覆盖缺口必须显示在报告与 CLI 摘要中。

## Done when

- [ ] 类型规范和实际脚本一致采用生成前布局策略；固定 Ungroup 与默认二次布局已移除。
- [ ] 尺寸适配规则明确横竖布局、分栏／折返、横向／竖向语义拆分，并有最终尺寸与可读性复核。
- [ ] 外部 I/O 样例检测稳定报告两个重叠边标签及其元素 ID；正常自身标签不误报。
- [ ] 标签、节点、路径碰撞与溢出专项测试，以及合法包含关系和修复后通过测试成立。
- [ ] 仓库流程、类、状态、结构、时序示例均完成检查；误报修正或覆盖限制明确记录。
- [ ] 报告、可选标记预览、退出码和渲染入口接入可复现；导出及检测不修改只读样例源。
- [ ] 开源代码来源、固定版本与许可、依赖准备和支持范围均随 skill 分发。
- [ ] 相关代码、文档、配置、示例与任务状态一致；完成专项检查和代码审查，分阶段提交可回滚结果。

## Verification and recovery

使用 Node 内置测试验证几何规则，浏览器集成测试验证字体和真实标签边界；PowerShell lint 与非破坏性调用验证脚本。端到端样例输入由命令参数提供，业务图和生成预览不提交。运行开发服务器或构建不是必要步骤。

外部 I/O 样例必须明确匹配“观测表、探测表及发波列表”与“宿主位姿”的相交问题。修复后的受控图应通过，防止检测器变成总是报错的检查。各种合法包含关系应有反例测试。

每阶段完成后记录验证结果并提交；无法验证的改动不强行提交。浏览器真实测量或生成布局配置若证实不可用，先在计划中记录证据和替代方案，再调整路线，不降低边标签验收标准。

## Sources

- [draw.io Mermaid 布局引擎](https://www.drawio.com/docs/manual/mermaid/mermaid-layout-engine/)
- [draw.io Mermaid 插入与容器](https://www.drawio.com/docs/manual/mermaid/)
- [ELK 间距模型](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/spacingdocumentation.html)
- [Sunwood SVG checker](https://github.com/Sunwood-ai-labs/draw-io-skill/blob/main/scripts/check-drawio-svg-overlaps.mjs)
- [Sunwood MIT license](https://github.com/Sunwood-ai-labs/draw-io-skill/blob/main/LICENSE)
- [diagram-builder checker](https://github.com/holdyounger/drawio-diagram-builder/blob/main/scripts/validate_visual_quality.py)
- [diagram-builder MIT license](https://github.com/holdyounger/drawio-diagram-builder/blob/main/LICENSE)
- [antigravity verifier](https://github.com/S-SUJAN-S/antigravity-drawio-mcp/blob/main/src/antigravity_drawio_mcp/verifier.py)
