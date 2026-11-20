// 由主题定义构建 Monaco 编辑器主题（编辑器画布 + 语法高亮 + 差异对比 + 内建组件）。
// 颜色全部派生自主题的 vars/syntax token，保证 12 套配色在编辑器内外的视觉一致。
import { getThemeById, themeModeOf, DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID, type ThemeDefinition } from './index';

export interface MonacoTokenThemeRule {
  token: string;
  foreground?: string;
  fontStyle?: string;
}

export interface MonacoThemeData {
  base: 'vs' | 'vs-dark' | 'hc-black';
  inherit: boolean;
  rules: MonacoTokenThemeRule[];
  colors: Record<string, string>;
}

interface MonacoLike {
  editor: {
    defineTheme(name: string, data: MonacoThemeData): void;
    setTheme(name: string): void;
  };
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 解析 #rgb/#rrggbb/#rrggbbaa 与 rgb()/rgba()；失败返回 null。 */
function parseColor(color: string | undefined): Rgba | null {
  if (!color) return null;
  const value = color.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
      a: 1,
    };
  }
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(value);
  if (hex) {
    return {
      r: parseInt(hex[1], 16),
      g: parseInt(hex[2], 16),
      b: parseInt(hex[3], 16),
      a: hex[4] === undefined ? 1 : parseInt(hex[4], 16) / 255,
    };
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }
  return null;
}

function channel(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
}

/**
 * Monaco 主题色只接受 #rrggbb / #rrggbbaa；传 rgba() 等 CSS 颜色会被判为非法
 * 并回退成纯红（#ff0000）。这里统一归一化成十六进制，否则选区、当前行、
 * 查找高亮等会全部显示成红色。
 */
function toMonacoColor(color: string | undefined, fallback: string): string {
  const parsed = parseColor(color);
  if (!parsed) return fallback;
  const base = `#${channel(parsed.r)}${channel(parsed.g)}${channel(parsed.b)}`;
  return parsed.a >= 0.999 ? base : base + channel(parsed.a * 255);
}

/** 把颜色调整为指定不透明度的 #rrggbbaa；无法解析时原样返回。 */
function alpha(color: string, a: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;
  return toMonacoColor(`rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${a})`, '#00000000');
}

export function buildMonacoTheme(theme: ThemeDefinition): MonacoThemeData {
  const v = theme.vars;
  const s = theme.syntax;
  const dark = theme.mode === 'dark';
  const accent = v['accent-color'];
  const accentSoft = v['accent-soft'];
  const selected = v['selected'];

  const colors: Record<string, string> = {
    // ── 编辑器画布 ──
    'editor.background': v['bg-document'],
    'editor.foreground': v['text-primary'],
    'editor.lineHighlightBackground': v['active'],
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': v['text-muted'],
    'editorLineNumber.activeForeground': v['text-secondary'],
    'editorCursor.foreground': accent,
    'editor.selectionBackground': selected,
    'editor.inactiveSelectionBackground': alpha(accent, dark ? 0.2 : 0.14),
    'editor.selectionHighlightBackground': alpha(accent, dark ? 0.12 : 0.08),
    'editorBracketMatch.background': accentSoft,
    'editorBracketMatch.border': accent,
    'editorIndentGuide.background1': v['border'],
    'editorIndentGuide.activeBackground1': v['text-muted'],
    'editorWhitespace.foreground': v['border-soft'],
    'editorLink.foreground': accent,
    'editor.wordHighlightBackground': accentSoft,
    'editor.wordHighlightStrongBackground': alpha(accent, dark ? 0.2 : 0.14),
    'editor.hoverHighlightBackground': accentSoft,
    // ── 查找/搜索高亮 ──
    'editor.findMatchBackground': alpha(accent, dark ? 0.36 : 0.3),
    'editor.findMatchHighlightBackground': alpha(accent, dark ? 0.18 : 0.13),
    'editor.findRangeHighlightBackground': alpha(accent, dark ? 0.12 : 0.08),
    // ── 内建组件（建议/悬浮/输入框/列表/通知） ──
    'editorWidget.background': v['bg-elevated'],
    'editorWidget.foreground': v['text-primary'],
    'editorWidget.border': v['border'],
    'editorSuggestWidget.background': v['bg-elevated'],
    'editorSuggestWidget.border': v['border'],
    'editorSuggestWidget.foreground': v['text-primary'],
    'editorSuggestWidget.selectedBackground': alpha(accent, dark ? 0.18 : 0.12),
    'editorSuggestWidget.highlightForeground': accent,
    'editorSuggestWidget.focusHighlightForeground': accent,
    'editorHoverWidget.background': v['bg-elevated'],
    'editorHoverWidget.border': v['border'],
    'editorHoverWidget.foreground': v['text-primary'],
    'input.background': v['surface-raised'] ?? v['bg-elevated'],
    'input.foreground': v['text-primary'],
    'input.border': v['border'],
    'inputOption.activeBorder': accent,
    'inputValidation.infoBorder': accent,
    'inputValidation.warningBorder': v['warning-color'],
    'inputValidation.errorBorder': v['danger-color'],
    'focusBorder': accent,
    'list.activeSelectionBackground': selected,
    'list.activeSelectionForeground': v['text-primary'],
    'list.inactiveSelectionBackground': v['surface-muted'],
    'list.hoverBackground': v['hover'],
    'list.focusBackground': selected,
    'list.focusForeground': v['text-primary'],
    'list.highlightForeground': accent,
    'badge.background': accent,
    'badge.foreground': '#ffffff',
    'notifications.background': v['bg-elevated'],
    'notifications.foreground': v['text-primary'],
    'notifications.border': v['border'],
    'notificationCenterHeader.background': v['bg-shell'],
    'notificationLink.foreground': accent,
    // ── 滚动条（Monaco 自绘滚动条的兜底；DOM 滚动条由 CSS 变量控制） ──
    'scrollbarSlider.background': alpha(v['text-muted'], dark ? 0.26 : 0.2),
    'scrollbarSlider.hoverBackground': alpha(v['text-muted'], dark ? 0.4 : 0.32),
    'scrollbarSlider.activeBackground': alpha(v['text-muted'], dark ? 0.5 : 0.42),
    // ── 差异对比视图 ──
    'diffEditor.insertedTextBackground': alpha(v['success-color'], dark ? 0.16 : 0.14),
    'diffEditor.removedTextBackground': alpha(v['danger-color'], dark ? 0.16 : 0.13),
    'diffEditor.insertedLineBackground': alpha(v['success-color'], dark ? 0.1 : 0.08),
    'diffEditor.removedLineBackground': alpha(v['danger-color'], dark ? 0.1 : 0.08),
    'diffEditor.diagonalFill': v['border-soft'],
    'diffEditorOverview.insertedForeground': v['success-color'],
    'diffEditorOverview.removedForeground': v['danger-color'],
    // ── Git 行号槽 ──
    'editorGutter.addedBackground': alpha(v['success-color'], 0.6),
    'editorGutter.deletedBackground': alpha(v['danger-color'], 0.6),
    'editorGutter.modifiedBackground': alpha(v['warning-color'], 0.6),
    // ── Peek 视图 ──
    'peekView.border': v['border-strong'],
    'peekViewEditor.background': v['bg-document'],
    'peekViewResult.background': v['bg-panel'],
    'peekViewResultSelectionBackground': selected,
    'peekViewTitle.background': v['bg-shell'],
    'peekViewTitleLabel.foreground': v['text-primary'],
    'peekViewTitleDescription.foreground': v['text-secondary'],
    'peekViewEditor.matchHighlightBackground': accentSoft,
    // ── 诊断 ──
    'editorMarkerNavigationError.background': v['danger-color'],
    'editorMarkerNavigationWarning.background': v['warning-color'],
    'editorMarkerNavigationInfo.background': accent,
  };

  const rules: MonacoTokenThemeRule[] = [
    // ── 基础语法 ──
    { token: 'comment', foreground: s.comment },
    { token: 'string', foreground: s.string },
    { token: 'string.escape', foreground: s.operator },
    { token: 'regexp', foreground: s.regexp },
    { token: 'number', foreground: s.number },
    { token: 'keyword', foreground: s.keyword },
    { token: 'operator', foreground: s.operator },
    { token: 'delimiter', foreground: v['text-secondary'] },
    { token: 'identifier', foreground: v['text-primary'] },
    { token: 'type', foreground: s.type },
    { token: 'class', foreground: s.type },
    { token: 'interface', foreground: s.type },
    { token: 'enum', foreground: s.type },
    { token: 'function', foreground: s.function },
    { token: 'variable', foreground: s.variable },
    { token: 'variable.predefined', foreground: s.variable },
    { token: 'tag', foreground: s.tag },
    { token: 'attribute.name', foreground: s.attribute },
    { token: 'attribute.value', foreground: s.string },
    { token: 'attribute.value.number', foreground: s.number },
    { token: 'constant', foreground: s.number },
    { token: 'boolean', foreground: s.keyword },
    { token: 'key', foreground: s.attribute },
    { token: 'annotation', foreground: s.attribute },
    { token: 'invalid', foreground: v['danger-color'] },
    // ── Markdown 编辑体验（主语言） ──
    { token: 'md-header', foreground: s.keyword },
    { token: 'md-strong', fontStyle: 'bold' },
    { token: 'md-emphasis', fontStyle: 'italic' },
    { token: 'md-link', foreground: s.function },
    { token: 'md-code', foreground: s.string },
    { token: 'md-quote', foreground: s.comment },
  ];

  // 主题 vars 里混有 rgba() 等写法，Monaco 只认十六进制，统一归一化。
  const monacoColors: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) {
    monacoColors[key] = toMonacoColor(value, '#00000000');
  }

  return {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules,
    colors: monacoColors,
  };
}

const definedThemes = new Set<string>();

/** 首次使用时 defineTheme，返回可传给 setTheme 的主题名。 */
export function ensureMonacoTheme(monaco: MonacoLike, id: string): string {
  const themeId = getThemeById(id) ? id : themeModeOf(id) === 'dark' ? DEFAULT_DARK_THEME_ID : DEFAULT_LIGHT_THEME_ID;
  if (!definedThemes.has(themeId)) {
    const theme = getThemeById(themeId);
    if (theme) monaco.editor.defineTheme(themeId, buildMonacoTheme(theme));
    definedThemes.add(themeId);
  }
  return themeId;
}
