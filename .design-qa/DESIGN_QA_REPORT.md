# Design QA Verdict: Pass with warnings

## Summary

Zeditor 的 UI 升级已按 `DESIGN.md` 和用户提供的配色、布局、组件规范完成。核心工作区、设置、AI、命令面板、沉浸模式、知识库和功能菜单均在实际运行界面中验证；12 套主题、800–1440px 布局、AA 对比度、键盘焦点和减少动态效果通过。剩余警告主要来自历史 CSS 债务、未运行 macOS/Linux 实机，以及未执行自动化屏幕阅读器扫描。

## Evidence Reviewed

- Design contract: `DESIGN.md`
- Source visual truth: 用户提供的 Light / Dark 色值、布局与组件规范
- Rendered implementation: `http://127.0.0.1:1425/`，React/Tauri WebView 预览
- Viewport/state/content match: 1440×900，示例 Markdown 文档，浅色 / 深色 / AI / 设置 / 命令面板 / 沉浸写作
- Screens/routes: 主工作区、文件与大纲、AI 对话、设置、命令面板、沉浸写作、功能菜单
- Automation reports: 无 axe 报告；使用 Playwright 无障碍快照、计算样式、Node 测试和 Rust 测试
- Screenshots/diffs: `test-output/ui-upgrade/`
- Source files/components: `src/styles/*`、`src/themes/*`、`src/components/MenuBar`、`SettingsPanel`、`StatusBar`、`AIChatbotPanel`、`RecoveryDialog`、`FileConflictDialog`、`LocalHistoryPanel`

## Blockers

无。

## Major Issues

无。

## Minor Issues

### 历史 CSS 仍保留少量平台专用硬编码

- Evidence: `src/styles/main.css`、`src/styles/workbench.css`
- Observed: 原生关闭按钮、旧版表格工具等仍有少量历史字面量。
- Expected: 新代码继续只使用语义 Token。
- User/design impact: 不影响当前主流程，但后续主题扩展需继续迁移。
- Recommended fix: 按组件逐步替换，避免一次性重排 11k 行主样式表。
- Verification: 本轮新增样式未引入组件硬编码颜色；主题对比度测试通过。

### 自动化无障碍扫描未执行

- Evidence: 当前项目未安装 axe，且本轮未新增开发依赖。
- Observed: 已完成计算样式、无障碍树、键盘顺序和焦点恢复检查。
- Expected: CI 中增加 axe 或等价扫描。
- User/design impact: 不能替代真实屏幕阅读器测试。
- Recommended fix: 后续在 CI 中增加 axe-core。
- Verification: 设置模态框 Tab / Shift+Tab / Esc、标签关闭按钮顺序、AI 图标按钮名称均通过运行时检查。

## Design Debt

- `main.css` 仍存在多轮历史覆盖，后续应按组件拆分。
- `comfort.css` 与 `typography.css` 已移除重复 Token，仅保留密度与缩放职责。
- Toast 与链接预览已从 `library.css` 迁移到全局 `workbench.css`。
- 设置页已从卡片堆叠改为分隔行列表。
- 功能菜单已归并为编辑、插入、文档与 AI、表格操作、视图、知识库、主题、语言和设置。

## Acceptable Differences

- 原始 `text-muted` 保留用户指定色值；UI 使用自动派生的 `muted-text` 以达到 AA。
- 非旗舰主题保留自身色相，只派生可读的前景、状态文字和实心按钮颜色。
- 未引入大型 UI 框架，继续复用现有组件和 CSS 架构。
- 截图来自实际运行的 WebView 预览和示例文档，不包含用户文件。

## Automation Artifacts

- Expected screenshots: 无独立设计稿，使用 `DESIGN.md` 与用户规范作为源真值
- Actual screenshots: `test-output/ui-upgrade/01-workbench-light.png` 至 `08-menu-grouped.png`
- Diff screenshots: 不适用
- JSON reports: 无；测试结果记录在 `docs/ui-upgrade-report-2026-11-28.md`

## Verification Checklist

- [x] 12 套主题逐套切换且无横向溢出
- [x] 800 / 900 / 960 / 1100 / 1440px 布局无页面或状态栏溢出
- [x] 浅色与深色主工作区实际截图
- [x] 字体、间距、颜色、图标、文案五类 fidelity 检查
- [x] default / hover / focus-visible / selected / disabled / empty / error 状态检查
- [x] 设置模态框焦点圈定、Esc 关闭、焦点恢复
- [x] 功能菜单视口内滚动，子菜单 fixed 定位不裁剪
- [x] `prefers-reduced-motion` 下过渡时长为 0.00001s
- [x] 无新增组件硬编码颜色或任意 Token 绕过
- [ ] macOS 实机验收（当前环境为 Windows）
- [ ] Linux 实机验收（当前环境为 Windows）
- [ ] 真实屏幕阅读器验收
