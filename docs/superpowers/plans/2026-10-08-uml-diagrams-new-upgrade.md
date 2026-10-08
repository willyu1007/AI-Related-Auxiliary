# uml-diagrams-new 升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. 本任务默认由当前 agent 串行执行；需要独立审查时遵循用户的委派边界。

**Goal:** 实现类型布局入口、成品尺寸适配及参考开源几何算法的第一版验收，稳定发现普通边标签遮挡。

**Architecture:** draw.io CLI 负责转换与导出，Node ESM 工具通过浏览器采集真实 SVG 几何，再执行复用并扩展的碰撞规则。检测器只读输入，输出可关联元素的报告与可选标记预览；现有 PowerShell 渲染入口负责编排。

**Tech Stack:** Node.js ESM、Node 内置测试、Playwright、draw.io CLI、PowerShell；新增包用 pnpm 管理。

**Spec:** [正式任务规格](../specs/2026-10-08-uml-diagrams-new-upgrade-design.md)

## Global constraints

- 修改对象为 `system/skills/uml-diagrams-new`；保持现有 skill 自包含和安装器整目录分发方式。
- 保留 `.mmd` 语义源；用户图只作为外部只读输入，业务材料与临时图不提交。
- 几何规则以真实文字边界与渲染路径为准，不能用字符数、XML 控制点或 foreignObject 外框代替。
- 采用开源函数时保留许可、上游版本、采用范围及改动说明；复用算法不等于照搬上游覆盖声明。
- 普通线交叉属于警告；合法容器、自身文字和自身连线标签必须排除。
- 不自动删语义节点、合并不同含义节点、重建整图或通过压小文字强行过尺寸。
- 未覆盖元素及运行失败不能报告为完整通过。
- 先失败测试，后最小实现；完成并验证的阶段形成独立提交。
- 不启动开发服务器、不运行构建；全局 skill 安装不属于当前源代码修改。

## Baseline

- 工作树在建档前干净，当前为 `main`。
- CLI 转换外部 I/O Mermaid 无组的探针已通过；临时输出已清理。
- 外部 I/O SVG 有 `data-cell-id`，但完整浏览器文字测量尚未运行。
- `node checks/run.mjs` 在 Windows 的 sensitive-ops 行为检查读取 `/dev/null` 时失败；任务验证需报告该基线限制，不顺带修改该检查。
- 现有静态检查报告本 skill 的两条跨 skill 引用和 upstream 文档机器路径；本轮仅新增任务文档，其本地链接、占位符与格式检查通过。实施时核对相关检查，不声称总检查通过。
- task-governance 安装器禁止向资源库自身安装；正式任务沿用本仓库已有规格／计划记录，不安装第二套治理系统。

## Phase 1 — 渲染与布局能力验证

**Purpose:** 固定本机转换器、SVG、浏览器及上游代码的真实契约，避免在估算文字和错误坐标系上实现检测。

**Interfaces:** 后续阶段消费每个元素的 `page`、`cellId`、类型、父子与端点关系、可见文字边界、轮廓和路径；所有几何使用同一页的 SVG 坐标系。

- [x] 创建 `codex/uml-diagrams-new-upgrade` 开发分支或使用用户选定的隔离工作区，保留其他工作树内容。
- [x] 记录实际可用的 Node、draw.io、Playwright 版本及浏览器路径；依赖准备采用 pnpm，分发配置不写本机路径。
- [x] 将外部 I/O 图作为参数输入浏览器测量探针，等待字体加载，读取两个边标签的实际文字矩形和所属 cell ID，断言它们相交。
- [x] 用独立受控图验证“不相交”与“调整后不相交”，避免坐标误读导致探针总是报告错误。
- [x] 对节点文字、边标签、独立文本、UserObject、嵌套容器、时序生命线和类图成员各读一份实际渲染结果，固定关联方法和正常包含关系。
- [x] 验证图结构类型在 Mermaid 源中指定 ELK 的 CLI 转换行为；验证时序配置保持顺序。记录实际可观测信息及无法证明的引擎回退。
- [x] 固定 Sunwood 上游提交与实际采用的几何函数，记录 diagram-builder 的参考规则和 MIT 许可。
- [x] 在规格的 Current evidence 和本计划中更新结果及后续阶段细节；通过后提交依赖准备、必要的持久测试与来源记录。

**Exit:** 普通边标签的真实坐标、来源元素 ID 及相交／不相交可以复现；生成布局配置和专用时序策略有运行证据。

**Recovery:** 临时探针位于系统临时目录，退出清理；能力不成立时记录具体失败和替代方案，保留边标签验收要求。

## Phase 2 — 几何检测与报告

**Files:**
- Create: `system/skills/uml-diagrams-new/scripts/check-diagram-geometry.mjs`
- Create: `system/skills/uml-diagrams-new/scripts/geometry-rules.mjs`
- Create: `system/skills/uml-diagrams-new/scripts/measure-svg.mjs`
- Create: `system/skills/uml-diagrams-new/tests/geometry.test.mjs`
- Create: `system/skills/uml-diagrams-new/tests/geometry-integration.test.mjs`
- Create: skill-local dependency manifest and third-party source/license record, named after Phase 1 verifies the adopted package and source layout.

**Interfaces:**
- `measureSvg(svgPath, drawioPath, options)` returns page-associated measured elements and coverage gaps.
- `checkGeometry(measuredPage)` returns findings carrying `rule`, `severity`, `cellIds`, `texts`, and collision geometry.
- CLI consumes `--drawio`, `--svg`, optional `--report`, `--preview`, `--browser`; exit codes are `0` / `1` / `2` as specified in the design.

- [x] 写标签相交与合法自身标签的失败测试；预期字面结果分别包含 `label-label` 和空错误列表。
- [x] 执行 `node --test system/skills/uml-diagrams-new/tests/geometry.test.mjs`，确认因待实现的行为失败，而不是依赖或语法错误。
- [x] 从固定版本采用几何基础函数，添加真实标签两两相交、线与标签相交规则，保留来源与许可。
- [x] 依次用失败测试实现 label-node、node-node、edge-node、文字溢出；每组都包含合法包含关系的反例。
- [x] 使用实际节点轮廓验证菱形、椭圆和圆角节点；未知形状产生 coverage gap，不能用外接矩形假装精确验收。
- [x] 实现浏览器测量和 XML/SVG 关联，覆盖 foreignObject 实际文字、UserObject、坐标变换、页面信息与字体准备。
- [x] 实现结构化报告、警告和覆盖状态，验证退出码；警告独立存在时不作为几何错误失败。
- [x] 添加可选标记预览，验证标记 ID 和报告一致，默认无文件输出。
- [x] 运行两组 Node 测试与外部 I/O 实际检查，确认同时报告两个标签内容及其 ID，并确认输入文件未被改写。
- [x] 审查误报、来源许可、输出范围及失败状态，更新规格 evidence 并提交已验证检测器。

**Exit:** 第一版规则、报告与覆盖声明成立；外部 I/O 遮挡稳定被发现，调整后的受控样例通过。

**Recovery:** 检测器输入只读；独立 CLI 的失败不会修改原图。阶段提交可整体回滚。

## Phase 3 — 类型布局与尺寸适配流程

**Files:**
- Modify: `system/skills/uml-diagrams-new/SKILL.md`
- Modify: `system/skills/uml-diagrams-new/scripts/render-diagram.ps1`
- Modify: `system/skills/uml-diagrams-new/layouts/README.md`
- Modify: relevant `references/*.md` and type configuration files.
- Add: generator configuration only for parameters verified in Phase 1.

- [x] 以受控 Mermaid 输入验证各图类型选中生成配置，保留 `.mmd`，转换时不重复运行默认布局与 ELK。
- [x] 将生成配置与转换后布局 JSON 分开；在渲染入口应用真实受支持配置，验证时序图不被一般图布局重排。
- [x] 移除固定 Ungroup 要求，明确容器组实际妨碍操作时才取消组合。
- [x] 将尺寸要求、适配顺序、横竖拆分含义、子图接续及文字可读性写入主 skill 和类型 reference。
- [x] 调整三层修改边界，允许几何工具计算坐标及标签／路由修复，保持语义修改回源码。
- [x] 样式和尺寸调整后由渲染入口导出 SVG 并调用检测器；将阻断问题、运行失败和覆盖缺口反馈给调用方。
- [x] 运行 PowerShell parser/lint 和受控渲染调用，验证路径含空格、输出完成等待、失败状态传递以及只读输入保护。
- [x] 逐项检查文档与实际 CLI 接口一致，修正失效的示例和引用，更新验证事实并提交。

**Exit:** skill 的默认流程与实际脚本一致，尺寸适配与检测的位置正确，没有固定 Ungroup 或隐含二次布局。

**Recovery:** 默认不改用户输入文件；生成配置失败须显式报告。该阶段与独立检测器分开提交。

## Phase 4 — 样例验收与完成

- [x] 对仓库流程、类、状态、结构、时序五种示例运行端到端检查，逐条核对报告；修正检测误报或记录有证据的覆盖限制。
- [x] 再运行外部 I/O 样例，确认指定的两个边标签相交报告；以受控修复样例确认重新测量后通过。
- [x] 验证生成后改变字体、换行或路径会重新测量，不复用旧的通过结果。
- [x] 检查尺寸规范对无尺寸要求、宽度超限、高度超限和语义拆分的行为指导；确认没有自动删内容或压缩字号的规则。
- [x] 运行相关 Node 测试、PowerShell lint 及仓库静态引用检查；总检查的既有 Windows 故障按实际证据报告。
- [x] 完成代码审查，处理第一版范围内的问题；清理临时探针、报告和预览。
- [x] 按规格 Done when 更新任务状态与计划检查框，记录最终命令、结果、支持范围和回滚提交。
- [x] 提交最终已验证改动，并向用户提供源文件、使用命令、测试结果及明确的覆盖限制。

**Exit:** 规格中的验收项均有实际证据，任务文档、代码、配置、示例和支持范围一致。

## Execution status

2026-10-08：已在 `codex/uml-diagrams-new-upgrade` 实施渲染测量、检测器和生成配置。

- Node 24.14.0、draw.io 31.3.2、Playwright 1.62.1；本机 Edge 通过显式 browser 参数运行。pnpm 11.25.0 已完成锁文件和本地依赖安装，未运行构建。
- 外部 I/O 图真实测量：ID 13 / 9 标签相交区域 `(294.5,117.5,80,24)`；覆盖缺口为空，业务源只读。
- 浏览器受控样例包含 UserObject、坐标变换、foreignObject 真实文字；移动标签后重新测量无错误，旧 SVG 对应新 XML 时报告覆盖缺口。
- 五类既有导出实测：流程、状态、时序和结构均无错误；类图 ID 11 的关联文字与 ID 12、13 多重性标签有两处真实相交。容器、类成员和生命线均无覆盖缺口。
- 五类生成前配置均经 CLI 转换成功；图结构请求 ELK、时序移除通用 layout 并保持专用配置。CLI 没有提供实际引擎回退的可验证标记，因此只声明已请求 ELK。
- 开源基础函数固定 Sunwood revision `131921b2039b02fc8ee16b23bdb951b1fbb59594`，附采用范围、修改说明和完整 MIT 许可。
- `node --test system/skills/uml-diagrams-new/tests/*.test.mjs`：8 项通过（含真实浏览器测量）。初始几何测试在空实现上有四项按预期失败。

实施完成：渲染入口、尺寸规则、类型 references 和五张维护样例已同步。最终专项测试 14 项通过，五类新生成样例覆盖完整且无错误。外部错误图通过入口返回 1，原文件哈希不变，交付 PNG 未生成；非法 Mermaid/修复 JSON 组合在转换前返回 2。

独立审查发现的问题均复现后修复，并以专项测试验证：对齐节点窄幅重叠、SVG 裁切、缺失及 tspan 字体、直接应用到轮廓的裁切。支持普通矩形文字 clipPath；复杂裁切、被裁切的轮廓/路径仍为覆盖缺口。消息与生命线交点合法，非所属生命线穿文字仍为错误。

最终验证：Node 内置测试；PowerShell parser/lint；五种真实 CLI 渲染；实际错误图和受控修复图；独立源代码审查；本地文档链接与 git diff --check。仓库总检查仍在 Windows 读取 /dev/null 失败；维护源码的静态检查保留原有三条发现，没有新增发现。静态源码检查排除了本地安装的 node_modules，不修改仓库检查器。

回滚点：0510481（正式设计）、0d54ee3（检测器与生成配置）；后续工作在本分支的流程接入提交中。未同步全局已安装 skill，未推送或合并。临时测量/导出文件在验证后清理；依赖按锁文件保留为本地忽略项。
