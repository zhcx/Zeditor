/**
 * 片段 / 模板的占位符展开。
 *
 * 纯函数，便于单元测试。支持 VNote 风格的日期占位符与文档上下文占位符：
 *   %yyyy% %yy% %MM% %dd% %HH% %mm% %ss% %MMM% %MMMM% %ddd% %dddd% %iso%
 *   %filename%  当前文档完整文件名（含扩展名）
 *   %no%        当前文档文件名（不含扩展名）
 *   %folder%    当前文档所在目录
 *   %title%     当前文档标题（无路径时使用）
 *   %cursor%    插入后光标停留位置（展开后从文本中移除）
 * 未知占位符原样保留，避免误伤正文里的 `%...%`。
 */

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_EN_SHORT = MONTHS_EN.map((name) => name.slice(0, 3));
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_EN_SHORT = WEEKDAYS_EN.map((name) => name.slice(0, 3));

export interface SnippetContext {
  /** 当前文档完整文件名（含扩展名）。 */
  fileName?: string;
  /** 当前文档文件名（不含扩展名）。 */
  baseName?: string;
  /** 当前文档所在目录。 */
  folder?: string;
  /** 当前文档标题。 */
  title?: string;
}

export interface ExpandedSnippet {
  text: string;
  /** 展开后光标的字符偏移（0 起）；没有 %cursor% 时为 undefined。 */
  cursor?: number;
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

function resolveToken(token: string, now: Date, context: SnippetContext): string | null {
  switch (token) {
    case 'yyyy': return String(now.getFullYear());
    case 'yy': return String(now.getFullYear()).slice(-2);
    case 'MM': return pad(now.getMonth() + 1);
    case 'M': return String(now.getMonth() + 1);
    case 'dd': return pad(now.getDate());
    case 'd': return String(now.getDate());
    case 'HH': return pad(now.getHours());
    case 'mm': return pad(now.getMinutes());
    case 'ss': return pad(now.getSeconds());
    case 'MMM': return MONTHS_EN_SHORT[now.getMonth()];
    case 'MMMM': return MONTHS_EN[now.getMonth()];
    case 'ddd': return WEEKDAYS_EN_SHORT[now.getDay()];
    case 'dddd': return WEEKDAYS_EN[now.getDay()];
    case 'date': return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    case 'time': return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    case 'iso': return now.toISOString();
    case 'filename': return context.fileName ?? '';
    case 'no': return context.baseName ?? stripExtension(context.fileName ?? '');
    case 'folder': return context.folder ?? '';
    case 'title': return context.title ?? context.baseName ?? '';
    default: return null;
  }
}

function stripExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index > 0 ? fileName.slice(0, index) : fileName;
}

/** 展开片段/模板中的占位符。 */
export function expandSnippetTokens(template: string, context: SnippetContext = {}, now: Date = new Date()): ExpandedSnippet {
  let text = template.replace(/%([A-Za-z]+)%/g, (match, token: string) => {
    const value = resolveToken(token, now, context);
    return value === null ? match : value;
  });

  let cursor: number | undefined;
  const marker = '%cursor%';
  const index = text.indexOf(marker);
  if (index >= 0) {
    cursor = index;
    text = text.slice(0, index) + text.slice(index + marker.length);
  }
  return { text, cursor };
}

/** 从文档路径推导片段上下文（兼容 Windows 反斜杠）。 */
export function snippetContextFromPath(path: string | null | undefined, title?: string): SnippetContext {
  if (!path) return { title };
  const normalized = path.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  const fileName = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const folder = slash > 0 ? path.replace(/[\\/][^\\/]*$/, '') : '';
  return {
    fileName,
    baseName: stripExtension(fileName),
    folder,
    title: title ?? stripExtension(fileName),
  };
}

/** 片段语法帮助文本，供管理对话框展示。 */
export const SNIPPET_TOKEN_HELP =
  '可用占位符：%yyyy% %MM% %dd% %HH% %mm% %ddd% %dddd% %MMM% %MMMM% · %filename% %no% %folder% %title% · %cursor%（插入后光标位置）';
