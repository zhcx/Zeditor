# Zeditor 对照 VNote（docs.vnote.fun/zh）功能差距分析与改进方案

> 版本基准：zeditor v0.6.8（分支 `codex/editor-writing-improvements`）
> 调研方式：通读 `docs.vnote.fun/zh` 全站文档 + 对 zeditor 源码（`src/**/*.{ts,tsx}`、`src-tauri/src`）逐项 grep 审计
> 本文只做「对比 + 方案」，具体实现由你确认后按顺序推进。

---

## 一、结论速览

**定位差异**
- **VNote** 是「知识库 / 笔记管理」型工具：强调笔记本组织、标签、同步、多笔记类型（PDF / Typst / 思维导图 / 加密文本）、片段模板与 Vi 模式。
- **Zeditor** 是「AI 驱动的 Markdown 写作编辑器」：在 AI 助手 / 本地 Agent、导出（HTML/PDF/Word/公众号/图片）、图床（Cloudinary/PicGo/S3/本地）、沉浸写作、中英混排中文排版、MCP、GitHub Actions 工作流可视化等方面明显领先 VNote。

**一句话结论**：没必要把 zeditor 变成 VNote。建议只吸收 VNote 中**「编辑效率类」**能力（片段、模板、标签、快速笔记、Vi 模式、分屏、PDF 阅读），对**「重平台类」**能力（Typst、思维导图可视化编辑器、加密、Git 双向同步）要单独立项、评估投入产出。

### 分级清单（总览）

| 优先级 | 能力 | 定性判断 |
| --- | --- | --- |
| **P0 强烈建议** | 片段 snippets、笔记模板 templates、快速访问置顶、跨平台富文本复制、标题自动编号 | 低风险、高频、贴合写作场景 |
| **P1 建议** | 标签系统、分屏多窗格、Vi 模式、快速笔记、PDF 阅读器、链接悬浮预览 | 中等投入、显著增强 |
| **P2 可选 / 谨慎** | 仪表盘首页、任务运行器、笔记本 Git/双向同步、加密笔记、思维导图可视化编辑器、Typst 集成 | 投入大或安全/兼容风险高 |
| **不建议引入** | 「笔记本」元数据索引层、完整命令 DSL（`--scope`）、分离置顶窗口 | zeditor 已有更轻量的等价方案，收益有限 |

---

## 二、逐项详细对比

### A. 笔记管理

| VNote 能力 | Zeditor 现状 | 差距 | 建议 |
| --- | --- | --- | --- |
| **笔记本(notebook)+文件夹+笔记** 三层结构，笔记本自带索引 | 多工作区根目录（`zeditor.workspace-roots`，最多 10 个最近文件夹）+ 目录树 + 标签页；无「笔记本」元数据/索引层 | 中：缺笔记本级索引（标签、搜索、同步的落点） | P2：不必引入「笔记本」概念；如需标签/同步，建一个轻量的「工作区索引」即可 |
| **文件类型**：MD / Text / MindMap(.mmm) / Typst(.typst) / PDF(只读) / Image / Other | 以 Markdown + 纯文本为主，可打开代码/配置；PDF 仅「转换」为 MD；无 mindmap / typst 原生类型 | 大 | 见下文 PDF / Typst / 思维导图专项 |
| **加密笔记**（正文加密、密码保护、.vne） | **无**（仅 WebDAV/S3 的 password 字段，与笔记加密无关；src-tauri 无 crypto 模块） | 大 | 见专项，P2 |
| **PDF 阅读器**（内置 pdf.js 6.2.108：翻页/缩放/旋转/文字选择/大纲/批注） | **无**（只有 PDF→Markdown 转换，`src-tauri/src/pdf/`） | 大 | 见专项，P1 |
| **导入 / 迁移**（导入 Markdown、目录、从其他工具迁移） | AnyDoc 转换 Office/PDF/EPUB/CSV→MD + 拖放打开目录为工作区；能力更强 | 无差距 | 可补「批量导入目录」小优化 |
| **标签**（一篇多标签、批量编辑、按标签浏览/搜索） | **无**（grep 命中 208 处均为 `tagName`/语法高亮 token 等误报） | 大 | 见专项，P1 |
| **笔记本同步**（内置 Git / WebDAV / 坚果云，双向、定时、冲突处理） | 仅 WebDAV/S3 **备份**（单向版本快照、20 版、SHA-256）；无 Git、无双向合并 | 中大 | 见专项，P2 |
| **快速访问与历史**（置顶「快速访问」+ 自动「历史」） | 有「近期记录 + 时间线」分组；无「置顶」 | 小 | P0：加「置顶/收藏」列表即可 |

### B. 编辑

| VNote 能力 | Zeditor 现状 | 差距 | 建议 |
| --- | --- | --- | --- |
| 编辑 / 阅读模式切换 | 有：源码对照 / 所见即所得 / 沉浸阅读 / 沉浸写作 四模式 | 无 | 已覆盖 |
| 原地预览 in-place preview | 所见即所得（直接在渲染排版上编辑）本身就是更强的「原地编辑」 | 无（等价或更优） | 不必引入 |
| 并排实时预览 side-by-side | 有「源码对照」左右分屏 + 双向滚动同步 + 点击预览跳源码 | 无 | 已覆盖 |
| 交互式表格预览写回源码 | 有表格编辑（斜杠命令 / 表格选择器 / 智能 Tab） | 基本相当 | — |
| 大纲 + 拖动标题移动章节 | 有可折叠大纲（点击跳转）；**无拖动排序** | 小 | 可选：大纲项拖拽重排 |
| 标题自动编号（阅读+编辑） | **无**（仅导出模板里有 `titleNumbering`） | 小 | P0 可选：编辑器内自动编号 |
| 演示 F9 | 有（Reveal.js，`---` 分页） | 无 | 已覆盖 |
| **分离窗口 + 置顶**（detached window / stay-on-top） | 无 | 中 | 不建议（Tauri 多窗口成本高、收益有限） |
| 外部变更自动重载 + 光标恢复 | 有文件冲突对话框 + 外部变更检测 | 基本相当 | — |
| 标签页 + **内容区分屏（split）** | 有多标签页；`分屏模式` 只是「源码对照」的别名，`detachDeletedTab` 是回收站逻辑；**无真正多窗格分屏** | 中 | 见专项，P1 |
| 链接悬浮预览（Ctrl+Click 浮层，可编辑） | **无** | 小-中 | P1：链接悬浮预览 |
| 从剪贴板插入 / HTML→MD 粘贴 | 有富文本粘贴→MD（`src/utils/htmlToMarkdown.ts`） | 无 | 已覆盖 |
| 跨平台富文本复制（到 Word / 公众号 / 印象笔记 / 原始 HTML） | 有「公众号排版导出」+ 富文本粘贴；**无一键复制富文本到剪贴板** | 小 | P0：复用公众号导出逻辑加「复制富文本」 |
| **片段 snippets**（可复用文本、占位符、快捷码、`%date%`/`%folder%`） | **无**（`template` 命中的全是导出模板/AI Genie 模板） | 大 | 见专项，P0 |
| **模板 templates**（新建笔记模板、每类型默认模板、支持片段变量） | **无**（只有导出模板） | 大 | 见专项，P0 |
| **Vi 模式**（Normal/Insert/Visual/命令行、motions、operators、寄存器） | **无**（grep `vim/viMode` 0 命中） | 大 | 见专项，P1 |
| Markdown 语法丰富度 | 更强（高亮 `==`、上/下标、`<details>`、脚注、wiki 链接、任务列表等） | zeditor 领先 | — |
| 数学与图表 | KaTeX / Mermaid / Markmap 齐全 + GitHub Actions 可视化 | 相当或更强 | — |
| 图片与图床 | Cloudinary/PicGo/S3/本地 + `.assets` 自动归档 | zeditor 更强 | — |
| 纯文本笔记 | 支持（纯文本 + 编码切换） | 相当 | — |
| **Typst**（原生编译 + 实时 PDF 预览 + 诊断） | **无**（grep 0 命中，无依赖） | 大 | 见专项，P2 |
| **思维导图**（原生可视节点编辑器 .mmm/.emind，可增删/拖拽/折叠节点） | 只有 Markmap：Markdown 标题→只读 SVG 交互视图 + 导出 PNG；**无可编辑节点画布** | 大 | 见专项，P2 |

### C. 搜索

| VNote 能力 | Zeditor 现状 | 差距 | 建议 |
| --- | --- | --- | --- |
| 搜索面板（当前文档/文件夹/笔记本/跨笔记本，按名称/内容/标签/路径） | 当前文档查找替换（区分大小写/正则/全部替换）+ 工作区文件与内容检索（正则/大小写/扩展名/忽略目录）+ Ctrl+P 统一搜索（命令/近期/打开文档/文档内容/工作区文件/工作区内容） | 相当或更强 | — |
| 统一入口命令语法（`Ctrl+G,G` + `--scope/--object` + 别名） | Ctrl+P 已有统一搜索，但**无 `--scope` 命令语法、无按标签检索** | 小 | 可并入标签专项：给 Ctrl+P 加 `tag:` 过滤 |
| 搜索结果按标签过滤 | 无 | 小 | 随标签系统提供 |

### D. 生产力

| VNote 能力 | Zeditor 现状 | 差距 | 建议 |
| --- | --- | --- | --- |
| **快速笔记**（全局热键 Ctrl+Alt+Q / 托盘 / 工具栏 + 预置 scheme 一键建笔记） | **无** | 中 | 见专项，P1 |
| **任务运行器**（VSCode 式：跑外部脚本/程序、JSON 任务、变量 `${buffer}`、控制台输出） | **无** | 中 | 见专项，P2 |
| 导出（HTML/PDF/图片/公众号/Word） | 更强：模板化导出 + 公式/图表/代码高亮 | zeditor 领先 | — |
| 仪表盘首页（可拖拽 sticker、通知中心） | **无首页**（启动即空标签页） | 中 | 见专项，P2 |

### E. 自定义

| VNote 能力 | Zeditor 现状 | 差距 | 建议 |
| --- | --- | --- | --- |
| 设置项完整度 | 完整（外观/编辑器/AI/图像/导出/WebDAV/S3 等） | 相当 | — |
| 主题与样式（内置 + 自定义 CSS） | 12 套内置主题（6 浅 6 深）整体联动；**无用户自定义主题 CSS** | 小 | P2：允许导入自定义主题 CSS |
| 快捷键可定制 | 有快捷键速查弹窗；**不可自定义绑定** | 小 | P2：快捷键自定义 |

---

## 三、值得引入的能力专项方案

> 字段说明：价值 / 工作量（S ≤ 3 天，M 3–10 天，L > 10 天）/ 风险 / 技术方案 / 涉及模块

### P0-1　片段 Snippets（S）
- **价值**：高频写作/技术文档复用的核心提效点；VNote 用户迁移刚需。
- **技术方案**：本地 JSON 存储（`localStorage` 或 Tauri app-data），用户自定义 + 内置片段；插入通过 `WysiwygController`/Monaco `executeEdits` 在光标处替换；支持占位符 `%date%`/`%time%`/`%folder%`/`%filename%`、选区包裹（`$$`）、光标落点（`@@`）。
- **涉及模块**：新增 `src/utils/snippets.ts`、`src/components/Snippets/SnippetPicker.tsx`；`src/stores/appStore.ts`（settings.snippets）；Settings 新分组；工具栏/命令面板入口。
- **风险**：低。

### P0-2　笔记模板 Templates（S）
- **价值**：新建笔记即带结构（日报/会议/周报等），降低空白恐惧。
- **技术方案**：模板存本地；`新建笔记` 时弹出模板选择（或按文件扩展名设默认模板）；模板内容支持片段变量（`%date%`、`%title%`）。
- **涉及模块**：新增 `src/utils/noteTemplates.ts`；改造 `appStore.addTab`/新建流程；Settings 模板管理页。
- **风险**：低。依赖 P0-1 的变量解析（可先合并实现）。

### P0-3　快速访问置顶（S）
- **价值**：常用笔记一键直达。
- **技术方案**：`appStore` 持久化 `pinnedDocs`（路径+标题）；Sidebar 增加「置顶」分组，支持添加/移除/拖入。
- **涉及模块**：`src/stores/appStore.ts`、`src/components/Sidebar/Sidebar.tsx`。
- **风险**：低。

### P0-4　跨平台富文本复制（S-M）
- **价值**：一键把文章以富文本（含公式/图表）复制到 Word / 公众号后台 / 邮件。
- **技术方案**：复用 `src/components/Export/WeChatExportDialog.tsx` 的「HTML + 内联样式」组装，用 `navigator.clipboard.write([new ClipboardItem({'text/html':..., 'text/plain':...})])` 写入剪贴板。
- **涉及模块**：`src/components/Export/`（抽公共函数）、工具栏/菜单入口。
- **风险**：低（部分平台剪贴板 HTML 兼容性需实测）。

### P0-5　标题自动编号（S，可选）
- **技术方案**：预览/所见即所得渲染后处理 heading，按层级生成 `1. / 1.1 / 1.1.1`；设置开关，默认关。
- **涉及模块**：`src/utils/markdownEnhancers.tsx`、`src/components/Wysiwyg/`、`src/components/Settings/`。
- **风险**：低（仅显示层，不改源码）。

### P1-1　标签系统 Tags（M）
- **价值**：知识组织与跨文档检索的核心能力，也是后续「按标签搜索/同步」的基础。
- **技术方案（推荐无侵入）**：标签存于文档 YAML frontmatter（`tags: [...]`）→ 可移植、可被其他工具识别；启动/保存时扫描工作区构建内存索引（`src/services/tagIndex.ts`）；增量更新靠文件监听；提供标签面板（按标签浏览、批量改名/删除）、正文顶部编辑标签、Ctrl+P 加 `tag:` 过滤。
- **涉及模块**：新增 `src/services/tagIndex.ts`、`src/stores/tagStore.ts`、`src/components/Tags/TagPanel.tsx`；改 `src/components/Sidebar/Sidebar.tsx`、`src/components/DocumentSwitcher/DocumentSwitcher.tsx`。
- **风险**：中（frontmatter 与正文/导出/预览的协调；大工作区首次索引性能）。备选：sidecar `.zeditor/tags.json`（不污染文件，但不可移植）。

### P1-2　分屏多窗格 Split View（M-L）
- **价值**：同屏对照两篇文档 / 边写边看参考资料，写作效率高。
- **技术方案**：把 `appStore` 的「单标签组」升级为「多 pane，每个 pane 一个标签组」，`src/components/Layout` 与 `TabsBar` 按 pane 渲染；拖拽标签跨 pane 移动；布局持久化。
- **涉及模块**：`src/stores/appStore.ts`（tab/pane 模型，改动面大）、`src/components/Layout/`、`src/components/TabsBar/`、`src/App.tsx`。
- **风险**：中-高（牵动全局布局与状态，需充分回归）。

### P1-3　Vi 模式（M）
- **价值**：面向 Vim 用户，提升纯键盘编辑效率。
- **技术方案**：Monaco 源编辑器接入 `monaco-vim`（npm），设置开关；仅作用于源码模式（所见即所得不强求）。快捷键与现有键位冲突需做映射表。
- **涉及模块**：`src/components/Editor/Editor.tsx`（Monaco 初始化处 attach/detach）、settings、`package.json`。
- **风险**：中（键位冲突、与智能 Tab/自动补全的交互）。

### P1-4　快速笔记 Quick Note（M）
- **价值**：灵感/待办随手记，不打断当前工作。
- **技术方案**：Tauri「全局快捷键 + 托盘」唤起小窗；预置 scheme（目标文件夹 + 文件名模式 + 模板）在设置里管理；一键创建并打开/后台保存。
- **涉及模块**：`src-tauri`（global-shortcut、tray、capabilities 权限）、`src/components/Settings/`、新建流程。
- **风险**：中（全局热键在部分系统/被占用需可配置；依赖 Tauri 权限配置）。

### P1-5　PDF 阅读器（M）
- **价值**：读 PDF 资料不必跳出应用；配合批注沉淀笔记。
- **技术方案**：`pdfjs-dist` 渲染；新增只读 `PdfViewer` 作为标签页类型 `kind:'pdf'`（`appStore` 扩展 tab 类型）；打开 `.pdf` 走阅读器而非强制转换；先做「翻页/缩放/大纲/文字选择」，批注（存 sidecar `comments.json`）作为二期。
- **涉及模块**：新增 `src/components/PdfViewer/PdfViewer.tsx`、`src/stores/appStore.ts`、`src/App.tsx`；`package.json`。
- **风险**：中（打包体积、Worker 配置、大文件性能）。

### P1-6　链接悬浮预览（S-M）
- **价值**：按住 Ctrl/Cmd 悬停本地链接即浮层预览目标文档，不必打开。
- **技术方案**：预览/所见即所得中对 `a[href]` 监听 Ctrl+hover，读取目标文件前若干行渲染浮层；本地 md/txt 支持，远程链接可显示标题/首段。
- **涉及模块**：`src/components/Preview/`、`src/components/Wysiwyg/`、`src/services/wikiLinks.ts`（复用路径解析）。
- **风险**：低-中。

### P2-1　仪表盘 / 首页（M）
- **价值**：启动有「今日概览/最近文档/待办」，体验更好。
- **技术方案**：新增首页标签类型 `kind:'home'`，网格布局 + 若干「贴纸」组件（问候、最近文档、统计、快捷入口）；布局持久化。
- **风险**：中（新 UI 体系），纯体验向，优先级低于写作能力。

### P2-2　任务运行器 Task Runner（M）
- **价值**：在笔记里直接跑脚本（构建/发布/格式化），技术写作场景有用。
- **技术方案**：`src-tauri` 提供受控子进程执行命令（白名单/工作区限制）；前端解析 JSON 任务定义（`inputs`、变量 `${buffer}`、`${selectedText}`、`${workspaceFolder}`）；控制台输出面板。
- **风险**：中-高（任意命令执行的安全边界，需沙箱/确认）。

### P2-3　笔记本 Git / 双向同步（L）
- **价值**：多设备/版本管理；比现有「备份」更接近真正同步。
- **技术方案**：优先「调用系统 git」实现提交/拉取/推送 + 定时；冲突用「保留本地/远端/两者」三选一 UI；WebDAV 双向需补 change 合并逻辑。
- **风险**：高（冲突合并、凭据管理、网络异常），建议单独立项。

### P2-4　加密笔记（M-L，安全敏感）
- **价值**：隐私笔记正文加密。
- **技术方案**：`src-tauri/src/crypto/`（`age` 或 `aes-gcm` + `argon2` 派生）；文档以 frontmatter 标记加密、正文加密封装；会话内缓存解锁密钥；搜索跳过密文、导出/打印需解锁。
- **风险**：高（密码学实现与密钥生命周期，必须谨慎设计并做安全评审）。

### P2-5　思维导图可视化编辑器（L）
- **价值**：真正的节点式脑图（比 Markmap 只读视图强）。
- **技术方案**：`react-flow` 等画布库 + 自定义 `.mmm`（JSON）文件类型 + 序列化；节点增删/连线/折叠/图标/链接；导出 PNG/SVG/MD。
- **风险**：高（新编辑器体系 + 新文件类型），投入大。

### P2-6　Typst 集成（L）
- **价值**：排版级文档（论文/简历/书籍）。
- **技术方案**：二选一——(a) `src-tauri` 内嵌 `typst` crate 编译（性能好、体积可控、需 Rust 集成）；(b) 前端 `typst.ts`/WASM（纯前端、包体大）。新增 `.typst` 标签类型 + 实时 PDF 预览 + 诊断。
- **风险**：高（编译器集成与包体、字体、预览性能）。

---

## 四、建议实施路线（若全部采纳）

> 顺序原则：先低风险高频（P0）打基础，再做显著增强（P1），重平台能力（P2）逐项评估。

**阶段一 · 快速见效（约 1–2 周）**
1. 片段 Snippets
2. 笔记模板 Templates（依赖片段变量，合并实现）
3. 快速访问置顶
4. 跨平台富文本复制
5. 标题自动编号（可选）
- 交付：设置面板新分组、命令面板/工具栏入口、单元测试（`node --test`）、文档更新。

**阶段二 · 组织与编辑增强（约 2–4 周）**
6. 标签系统（frontmatter + 索引 + 标签面板 + Ctrl+P `tag:` 过滤）
7. 链接悬浮预览
8. 快速笔记（Tauri 全局热键 + 托盘）
9. Vi 模式（monaco-vim）

**阶段三 · 大能力（约 3–5 周）**
10. 分屏多窗格
11. PDF 阅读器
12. 任务运行器
13. 仪表盘首页

**阶段四 · 重平台能力（按需立项）**
14. 笔记本 Git / 双向同步
15. 加密笔记（安全评审先行）
16. 思维导图可视化编辑器
17. Typst 集成

**每个阶段验收标准**：`tsc -b && vite build` 通过、`eslint .` 无新增告警、`node --test tests/*.test.ts` 全绿、关键路径手工回归（新建/编辑/预览/导出/保存），并补对应 `docs/guide/*` 文档。

---

## 五、请你确认

1. 以上对比是否与你的判断一致？是否有遗漏的能力想补充？
2. **选择要实现的项**（可只选 P0，或 P0+P1，或指定具体编号），我再据此生成可执行的实现计划并按顺序推进。
3. 是否使用 **AgentTeams**（多智能体协作）来并行实现所选功能？或由我单线程按阶段实现？

> 说明：在你明确「要实现哪些」之前，我不会改动任何代码。

---

## 六、实施进展（2026-11-13）

已按确认范围实现 **P0-1 ~ P0-5 + P1-6**，均通过 `tsc -b`、`eslint .`、`node --test tests/*.test.ts`（809 项断言全部通过）。

| 编号 | 能力 | 实现要点 | 主要文件 |
| --- | --- | --- | --- |
| P0-1 | 片段（Snippets） | 片段库 + 日期/文件名/%cursor% 等占位符；功能菜单/工具栏/命令面板入口插入 | src/utils/snippetExpansion.ts、src/stores/libraryStore.ts、src/components/Library/SnippetsDialog.tsx、src/services/libraryActions.ts |
| P0-2 | 笔记模板（Templates） | 模板库，可导入/导出 JSON；「用模板新建」一键生成新文档 | src/components/Library/TemplatesDialog.tsx、src/services/libraryActions.ts |
| P0-3 | 快速访问置顶 | 侧栏「快速访问」区，文件/文件夹右键置顶，可点击打开与取消置顶 | src/components/Library/PinnedSection.tsx、src/components/Sidebar/Sidebar.tsx |
| P0-4 | 跨平台富文本复制 | 将 Markdown 渲染为内联样式 HTML，写入剪贴板 text/html，可粘贴到 Word/笔记应用 | src/utils/richTextCopy.ts、src/services/libraryActions.ts |
| P0-5 | 标题自动编号 | 预览中按 1 / 1.1 / 1.1.1 自动编号，只影响阅读视图，不改源码；设置可开关 | src/utils/headingNumbering.ts、src/utils/markdownEnhancers.tsx、src/components/Preview/Preview.tsx |
| P1-6 | 链接悬浮预览 | 悬停链接弹出卡片：外部链接显示域名，本地笔记经 Tauri `link_preview` 读取标题与开头摘要 | src/utils/linkPreview.ts、src-tauri/src/commands.rs、src-tauri/src/main.rs |

新增设置项（设置 → 编辑器 → 显示设置）：「标题自动编号」「链接悬浮预览」。

> 未实现项（如 PDF 阅读器、Typst、思维导图可视化编辑器、笔记本同步、加密笔记、Vi 模式等）仍保留在路线图中，待后续按优先级推进。
