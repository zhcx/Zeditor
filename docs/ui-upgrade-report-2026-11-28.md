# Zeditor UI/UX 全面升级交付报告

日期：2026-11-28

分支：`feature/textus-writing-workflow`

基础提交：`da8d4c0`

状态：代码、测试、截图和 Windows 安装包已完成；本轮修改尚未提交或推送。

## 1. UI 改造总结

本轮在不重写项目、不更换 React / Zustand / Monaco / Tauri 的前提下，完成了一次跨工作台的 UI/UX 收敛：

- 建立唯一的 `--ui-*` 语义 Token 契约，消除 `workbench.css`、`comfort.css`、`typography.css` 的重复尺寸定义。
- 保留 12 套主题的名称、ID、切换逻辑和用户配置，只扩展调色板与可读性派生 Token。
- 旗舰浅色 / 深色主题采用指定配色，品牌深蓝与交互强调色分离。
- 核心工作台统一为活动栏 48px、标题栏 38px、标签栏 36px、状态栏 26px。
- 设置页由卡片堆叠改为轻量分隔行列表；控件高度、圆角、焦点和禁用态统一。
- AI、Agent、恢复、冲突、历史、导出、命令面板、Toast 和链接预览统一到语义色与弹层规范。
- 状态栏新增实时光标行列；标签关闭按钮不再进入非活动 Tab 顺序；AI 输入框高度支持键盘调整。
- 关键模态框共用焦点圈定、Esc 和焦点恢复 Hook。
- 功能菜单按“编辑、插入、文档与 AI、表格操作、视图、知识库、主题、语言、设置”归并；主菜单可滚动，子菜单不被裁剪。
- 文件菜单删除重复导出入口，并修复“最近文件夹”子菜单被误识别为导出菜单的问题。

## 2. 设计系统说明

设计契约已写入 `DESIGN.md`，包含标准 frontmatter、颜色、字体、布局、阴影、形状、组件状态、可访问性和禁止事项。

实现分工：

- `src/styles/main.css`：原始调色板、兼容别名和历史组件样式。
- `src/styles/workbench.css`：唯一 `--ui-*` 语义契约、全局控件和弹层规则。
- `src/styles/comfort.css`：工作台密度与细节微调，不再重复定义尺寸 Token。
- `src/styles/typography.css`：只负责用户字号缩放和文字层级映射。
- `src/themes/index.ts`：12 套主题注册与派生 Token。
- `src/themes/colorTokens.ts`：对比度、可读前景、实心按钮和文字颜色派生。
- `src/hooks/useModalFocus.ts`：模态焦点圈定、Esc、焦点恢复。

## 3. 配色与字体规范

### 旗舰浅色

| 角色 | 色值 |
| --- | --- |
| 应用背景 | `#F7F8FA` |
| 侧栏背景 | `#EEF1F5` |
| 编辑区背景 | `#FFFFFF` |
| 品牌色 | `#173E7A` |
| 交互强调色 | `#356AE6` |
| 主文字 | `#202938` |
| 次级文字 | `#667085` |
| 弱化文字 | `#98A2B3` |
| 边框 | `#E2E6ED` |
| 成功 / 警告 / 错误 | `#249B68` / `#D99A24` / `#D94B55` |

### 旗舰深色

| 角色 | 色值 |
| --- | --- |
| 应用背景 | `#171B22` |
| 侧栏背景 | `#1D232D` |
| 编辑区背景 | `#202733` |
| 交互强调色 | `#6EA8FE` |
| 主文字 | `#E6EBF2` |
| 次级文字 | `#A0AABA` |
| 边框 | `#303947` |
| 成功 / 警告 / 错误 | `#3FB982` / `#E5AE55` / `#F07178` |

原始弱化文字保留指定色值；UI 实际使用派生的 `muted-text`，保证侧栏上的小字达到 AA。所有主题的按钮前景、强调文字、状态文字、次级文字和弱化文字均有自动对比度测试。

字体规范：

- UI：Windows 优先 Microsoft YaHei / Segoe UI，Linux 回退 Noto Sans CJK SC，macOS 沿用系统字体覆盖。
- 正文：尊重用户已保存字体与字号；阅读模式支持 Noto Serif SC / Songti SC。
- 代码：JetBrains Mono → Cascadia Code → SFMono-Regular → Consolas。
- UI 默认 13px，次级 12px，说明 11px，面板标题 14px；用户字号缩放继续生效。

## 4. 修改文件清单

### 设计系统与主题

- `DESIGN.md`
- `src/themes/index.ts`
- `src/themes/colorTokens.ts`
- `src/styles/main.css`
- `src/styles/workbench.css`
- `src/styles/comfort.css`
- `src/styles/typography.css`
- `src/styles/settings-ui.css`
- `src/styles/settings-select.css`
- `src/utils/appearanceSettings.ts`

### 核心工作区

- `src/App.tsx`
- `src/components/MenuBar/MenuBar.tsx`
- `src/components/TabsBar/TabsBar.tsx`
- `src/components/StatusBar/StatusBar.tsx`
- `src/components/Editor/Editor.tsx`
- `src/components/Wysiwyg/WysiwygController.ts`
- `src/types/editor.ts`
- `src/components/DocumentSwitcher/document-switcher.css`

### 辅助面板与弹窗

- `src/components/Settings/SettingsPanel.tsx`
- `src/components/Chatbot/AIChatbotPanel.tsx`
- `src/components/Recovery/RecoveryDialog.tsx`
- `src/components/Recovery/recovery.css`
- `src/components/FileConflict/FileConflictDialog.tsx`
- `src/components/FileConflict/file-conflict.css`
- `src/components/Sidebar/LocalHistoryPanel.tsx`
- `src/styles/localHistory.css`
- `src/components/Library/library.css`
- `src/hooks/useModalFocus.ts`

### 知识库（同一工作区的前序未提交成果）

- `src/components/Icons/iconGeometry.ts`
- `src/components/Knowledge/DatabaseView.tsx`
- `src/components/Knowledge/KnowledgePanel.tsx`
- `src/components/Knowledge/knowledgeModel.ts`
- `src/components/Knowledge/KnowledgeQuickNote.tsx`
- `src/components/Knowledge/KnowledgeSearch.tsx`
- `src/components/Knowledge/KnowledgeSetup.tsx`
- `src/components/Knowledge/KnowledgeSummary.tsx`
- `src/services/knowledgeActions.ts`
- `src/stores/knowledgeStore.ts`
- `src/utils/knowledgeSearch.ts`
- `src/styles/knowledge.css`

### 测试与报告

- `tests/themeDesignTokens.test.ts`
- `tests/workbenchUi.test.ts`
- `tests/editorDisplayWiring.test.ts`
- `tests/editorLayout.test.ts`
- `tests/knowledgePanelWiring.test.ts`
- `tests/knowledgeFavorites.test.ts`
- `tests/knowledgeNavigation.test.ts`
- `tests/knowledgeNoteCreate.test.ts`
- `tests/knowledgeSearch.test.ts`
- `.design-qa/DESIGN_QA_REPORT.md`
- `docs/ui-upgrade-report-2026-11-28.md`

## 5. 新增组件清单

本轮没有为了视觉升级引入大型 UI 框架或重复组件库，新增的是可复用基础模块：

- `useModalFocus`：模态焦点圈定、Esc 关闭和焦点恢复。
- `colorTokens`：主题对比度与可读颜色派生。
- 知识库组件：`KnowledgeSetup`、`KnowledgeSummary`、`KnowledgeSearch`、`KnowledgeQuickNote`。
- 全局 Toast 与链接预览样式：从 Library 局部样式迁移到工作台全局层。

## 6. 删除或合并的冗余样式

- 合并 `workbench.css`、`comfort.css`、`typography.css` 的重复尺寸 Token。
- 将 Toast 与链接预览从 `library.css` 合并到 `workbench.css`，确保全局可用。
- 设置页移除卡片边框、阴影和 Hover 底色，改为分隔行列表。
- AI 审阅弹窗移除固定蓝、红、绿硬编码，改用语义 Token。
- 恢复与冲突弹窗移除旧变量回退和固定阴影，统一 Modal z-index、圆角与焦点。
- 功能菜单移除重复导出入口，并按任务归并。
- 修复失效的 `[data-theme="dark"]` 选择器为 `[data-theme$="-dark"]`。
- 补充 `--bg-input`、`--surface-*`、`--text-danger` 等兼容别名，避免旧组件变量失效。

## 7. 测试执行结果

| 检查 | 结果 |
| --- | --- |
| `npm test` | 1002 passed，0 failed |
| `npm run lint` | 通过 |
| `npx tsc -b --pretty false` | 通过 |
| `npm run build` | 通过，3606 modules |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 269 passed，10 ignored |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | 通过 |
| 12 套主题运行时切换 | 全部应用成功，无横向溢出 |
| 800 / 900 / 960 / 1100 / 1440px | 页面与状态栏无横向溢出 |
| 主题文字与按钮对比度 | 全部达到 AA 4.5:1 |
| 减少动态效果 | 过渡与动画时长 `0.00001s` |
| 设置模态键盘 | Tab / Shift+Tab 圈定，Esc 关闭，焦点恢复 |
| 功能菜单 | 主菜单视口内滚动，子菜单 fixed 定位不裁剪 |
| NSIS / MSI | 7-Zip 完整性测试通过 |
| SHA-256 | 三个产物与清单一致 |

最终 Windows 产物：

- [NSIS 安装包](../src-tauri/target/release/bundle/nsis/Zeditor_0.7.0_x64-setup.exe)


SHA-256：`e61cc292e07d8ca8dfab8a7fc674228b98137a7d0e57a502fb86a8902123699b`
- MSI 安装包：`src-tauri/target/release/bundle/msi/Zeditor_0.7.0_x64_en-US.msi`


SHA-256：`a9f35d9cc39ab832c9e2c614deb0aa371ec041b8d2d2c959746209dae434b669`
- [独立程序](../src-tauri/target/release/zeditor.exe)


SHA-256：`3379cb6df4ca4e1ee4aedb4399d48e163852f791beb8da9c4256886be89db349`
- [校验清单](../src-tauri/target/release/SHA256SUMS.txt)

## 8. 已知问题

- 当前验收环境为 Windows；macOS 与 Linux 完成静态适配检查，但未实机运行。
- 未执行自动化 axe 或真实屏幕阅读器扫描；已完成无障碍树、键盘、焦点、ARIA 和对比度检查。
- `main.css` 仍有历史遗留覆盖和少量平台专用字面量，后续应按组件继续拆分。
- Windows 程序未进行 Authenticode 签名，首次运行可能出现 SmartScreen 提示。
- 本轮修改尚未提交或推送。

## 9. 实际运行截图

截图来自实际运行的 Zeditor WebView 预览，视口 1440×900，使用示例 Markdown 文档，不包含用户文件。

### 主工作区浅色

![主工作区浅色](../test-output/ui-upgrade/01-workbench-light.png)

### 主工作区深色

![主工作区深色](../test-output/ui-upgrade/02-workbench-dark.png)

### AI 助手展开

![AI 助手](../test-output/ui-upgrade/03-ai-assistant.png)

### 文件管理与大纲

![文件管理与大纲](../test-output/ui-upgrade/04-files-outline.png)

### 设置界面

![设置界面](../test-output/ui-upgrade/05-settings.png)

### 命令面板

![命令面板](../test-output/ui-upgrade/06-command-palette.png)

### 沉浸写作

![沉浸写作](../test-output/ui-upgrade/07-zen-writing.png)

### 归并后的功能菜单

![功能菜单](../test-output/ui-upgrade/08-menu-grouped.png)

## 10. 后续优化建议

- 在 CI 中增加 axe-core 和关键界面视觉快照。
- 在 macOS 与 Linux 实机上跑一遍主题、窗口控制、菜单和输入法回归。
- 按组件逐步拆分 `main.css`，继续消除历史 `!important` 和硬编码颜色。
- 为 12 套主题增加自动截图对比，防止未来主题漂移。
- 将“主题 Token 对比度”与“菜单视口边界”加入浏览器回归脚本。
