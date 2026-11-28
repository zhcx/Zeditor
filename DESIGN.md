---
version: alpha
name: zeditor-workbench
description: Zeditor 的极简专业 Markdown 桌面工作台设计契约。品牌深蓝与交互强调色分离，12 套主题共享语义 Token，覆盖工作台、AI、设置、弹窗与沉浸模式。
colors:
  primary: "#356AE6"
  on-primary: "#FFFFFF"
  brand: "#173E7A"
  canvas: "#F7F8FA"
  sidebar: "#EEF1F5"
  editor: "#FFFFFF"
  surface: "#FFFFFF"
  surface-subtle: "#F4F6F9"
  ink: "#202938"
  ink-secondary: "#667085"
  ink-muted: "#98A2B3"
  secondary-text: "#5D6B7E"
  muted-text: "#6B7280"
  hairline: "#E2E6ED"
  focus: "#356AE6"
  success: "#249B68"
  warning: "#D99A24"
  danger: "#D94B55"
  info: "#356AE6"
typography:
  ui-xs:
    fontFamily: '"Microsoft YaHei", "Segoe UI", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: 0px
  ui-sm:
    fontFamily: '"Microsoft YaHei", "Segoe UI", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  ui-md:
    fontFamily: '"Microsoft YaHei", "Segoe UI", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  panel-title:
    fontFamily: '"Microsoft YaHei", "Segoe UI", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0px
  document-body:
    fontFamily: '"Microsoft YaHei", "Segoe UI", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0px
  document-title:
    fontFamily: '"Microsoft YaHei", "Segoe UI", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: 28px
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: -0.4px
  code-md:
    fontFamily: '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, monospace'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0px
  button-md:
    fontFamily: '"Microsoft YaHei", "Segoe UI", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0px
rounded:
  none: 0px
  xs: 4px
  sm: 5px
  md: 8px
  lg: 12px
  full: 999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  section: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: [0px, 14px]
    height: 30px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: [0px, 14px]
    height: 30px
  icon-button:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.secondary-text}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.sm}"
    padding: 0px
    height: 30px
    width: 30px
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.sm}"
    padding: [0px, 12px]
    height: 34px
  tab:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.secondary-text}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.none}"
    padding: [0px, 12px]
    height: 36px
  tree-row:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.secondary-text}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.none}"
    padding: [0px, 8px]
    height: 24px
  status-item:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.secondary-text}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.sm}"
    padding: [0px, 6px]
    height: 24px
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.lg}"
    padding: [20px, 20px]
  menu-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary-text}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.sm}"
    padding: [0px, 10px]
    height: 30px
  badge:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.secondary-text}"
    typography: "{typography.ui-xs}"
    rounded: "{rounded.full}"
    padding: [1px, 8px]
  toast:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.md}"
    padding: [10px, 14px]
  empty-state:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.secondary-text}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.md}"
    padding: [20px, 20px]
---

## Overview

Zeditor 应该像一件安静、可靠的写作工具：内容优先、 chrome 退后、状态明确。视觉语言融合 Typora / MarkText 的文档纯粹感、VS Code 的专业工作台结构，以及 AppFlowy / SiYuan 的现代组件一致性，但不复制任何参考产品的界面。

实现源是 `src/styles/main.css` 的调色板、`src/styles/workbench.css` 的 `--ui-*` 语义契约、`src/styles/comfort.css` 的密度微调，以及 `src/themes/index.ts` 的 12 套主题。主题 ID、名称、切换逻辑和用户设置键不在本契约中变更。

## Colors

旗舰浅色主题使用 frontmatter 中的字面值。旗舰深色主题覆盖为：

- canvas `#171B22`，sidebar `#1D232D`，editor `#202733`；
- primary / focus `#6EA8FE`，on-primary `#101828`，brand `#6EA8FE`；
- ink `#E6EBF2`，ink-secondary `#A0AABA`，ink-muted `#7F8A9E`；
- hairline `#303947`，success `#3FB982`，warning `#E5AE55`，danger `#F07178`。

`brand-color` 只用于品牌识别，`accent-color` 用于交互。实心按钮使用 `accent-solid` / `accent-solid-hover`；文字链接和状态文字使用 `accent-text` / `success-text` / `warning-text` / `danger-text`。原始 `text-secondary` / `text-muted` 保留指定色值，UI 实际使用派生的 `secondary-text` / `muted-text`，避免浅色侧栏上的弱化文字低于 AA。这些派生 Token 由 `src/themes/colorTokens.ts` 自动保证对比度，其他 10 套主题保留自身色相。

禁止用颜色单独表达状态；保存、审批、错误、成功必须同时有文字或图标。

## Typography

UI 默认 13px，次级 12px，说明 11px，面板标题 14px。用户可通过设置缩放 UI；所有尺寸 Token 使用 `--ui-font-scale` 计算。正文尊重用户已保存的字号与字体，本契约不强制迁移现有配置。

Windows 优先 Microsoft YaHei / Segoe UI，Linux 回退 Noto Sans CJK SC，macOS 沿用系统字体覆盖。代码字体优先 JetBrains Mono、Cascadia Code、Consolas。阅读模式可使用 Noto Serif SC / Songti SC。

## Layout

- 标题栏 38px，活动栏 48px，侧栏标题 40px，标签栏 36px，状态栏 26px。
- 文件侧栏建议 220–260px，AI 侧栏建议 300–340px；分隔条保留拖动、键盘与双击复位。
- 设置使用左侧分类导航与右侧分行表单，不堆叠卡片。
- 编辑区保持纯色背景、无装饰阴影；正文宽度、标题节奏、引用、代码块和表格由内容样式统一。

## Elevation & Depth

默认工作台不使用浮起卡片。只有菜单、弹窗、Toast 和链接预览使用 `--ui-shadow-menu` / `--ui-shadow-dialog`。边框与留白优先于阴影表达层级。

## Shapes

控件使用 4–6px 小圆角，面板与输入区使用 8px，弹窗使用 12px。避免胶囊形工作台按钮和大面积渐变。原生窗口关闭按钮保留平台语义。

## Components

- Button / IconButton：30px 高，主按钮实心，次按钮轻边框，图标按钮 30×30px。
- Input / Select：34px 高，焦点使用品牌强调色边框与 3px 浅色外圈。
- Tabs / TreeItem：标签 36px，文件树 24px；当前项同时有底色、文字权重和指示条。
- Menu / Popover / ContextMenu：统一 5–8px 圆角、菜单阴影和 120–180ms 过渡。
- Modal / Dialog：12px 圆角、清晰标题、底部动作区；必须提供 Esc 与可见焦点。
- Toast / Progress / EmptyState / LoadingState：低视觉权重，状态文案优先，动画不阻塞输入。
- AI / Agent：输入框独立侧栏，思考、执行、审批、成功、失败使用同一语义状态色。

## Do's and Don'ts

Do:

- 复用 `--ui-*` Token 和现有 `AppIcon`、`FileTypeIcon`、`PanelDivider`、`SettingsSelect`。
- 用边框、留白、文字层级区分区域。
- 保留 Monaco、WYSIWYG、同步滚动、快捷键、Zustand 细粒度订阅和 Tauri IPC。
- 为所有交互提供 default / hover / focus-visible / active / selected / disabled / loading / empty / error 状态。

Don't:

- 不在组件中新增硬编码颜色、阴影或一套独立圆角。
- 不堆叠卡片、不使用大面积渐变和高饱和背景。
- 不为装饰添加持续动画，不绕过 `prefers-reduced-motion`。
- 不改主题名称、用户配置、编辑器生命周期、文件保存、AI 审批或 MCP 协议。

## Responsive Behavior

桌面最小窗口 800×600。窄窗口优先保留编辑器和活动栏，侧栏可独立折叠；标题栏命令入口在窄宽度下收缩而不是消失。知识库使用容器查询，250px 左右保持 3×2 导航。设置导航可独立滚动。

## Known Gaps

- 本次运行时环境为 Windows；macOS 与 Linux 通过既有平台样式和静态约束检查，未在对应操作系统实机运行。
- `main.css` 仍保留历史遗留选择器与平台专用颜色；后续应继续按组件迁移到语义 Token，不在本轮进行高风险全量重排。
- 项目未引入大型 UI 框架，也未新增 React 组件库；公共组件继续复用现有实现。
