import { Document, isMap, parseDocument } from 'yaml';

export interface FrontmatterParseResult {
  exists: boolean;
  data: Record<string, unknown>;
  body: string;
  /** 元数据围栏在原文中的区间；不存在时为 null。 */
  range: { start: number; end: number; closeStart: number } | null;
  errors: string[];
}

function invalid(message: string): FrontmatterParseResult {
  return { exists: false, data: {}, body: '', range: null, errors: [message] };
}

/** 解析文件起始 frontmatter，不修改 BOM、换行和正文。 */
export function parseFrontmatter(source: string): FrontmatterParseResult {
  const bom = source.startsWith('\uFEFF') ? 1 : 0;
  const firstEnd = source.indexOf('\n', bom);
  const firstLine = source.slice(bom, firstEnd < 0 ? source.length : firstEnd).replace(/\r$/, '');
  if (firstLine.trim() !== '---') return { exists: false, data: {}, body: source, range: null, errors: [] };
  if (firstEnd < 0) return invalid('frontmatter 缺少结束围栏');

  let cursor = firstEnd + 1;
  let closeStart = -1;
  let closeEnd = -1;
  while (cursor <= source.length) {
    const next = source.indexOf('\n', cursor);
    const end = next < 0 ? source.length : next;
    const line = source.slice(cursor, end).replace(/\r$/, '');
    if (line.trim() === '---' || line.trim() === '...') {
      closeStart = cursor;
      closeEnd = next < 0 ? end : end + 1;
      break;
    }
    if (next < 0) break;
    cursor = next + 1;
  }
  if (closeStart < 0) return invalid('frontmatter 缺少结束围栏');

  const yamlSource = source.slice(firstEnd + 1, closeStart);
  const document = parseDocument(yamlSource, { uniqueKeys: true, prettyErrors: true, strict: false });
  const errors = document.errors.map(error => error.message);
  if (document.contents && !isMap(document.contents)) errors.push('frontmatter 顶层必须是键值映射');
  const value = document.toJS({ maxAliasCount: 100 });
  if (value !== undefined && value !== null && (typeof value !== 'object' || Array.isArray(value))) {
    errors.push('frontmatter 顶层必须是键值映射');
  }
  return {
    exists: true,
    data: value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {},
    body: source.slice(closeEnd),
    range: { start: bom, end: closeEnd, closeStart },
    errors,
  };
}

/** 通过 YAML CST 局部更新属性，保留注释、键顺序和未知字段。 */
export function updateFrontmatter(source: string, patches: Record<string, unknown | null>): string {
  const parsed = parseFrontmatter(source);
  if (parsed.errors.length) throw new Error(`frontmatter 语法错误：${parsed.errors[0]}`);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';

  if (!parsed.exists || !parsed.range) {
    const entries = Object.entries(patches).filter(([, value]) => value !== null);
    if (!entries.length) return source;
    const document = new Document();
    for (const [key, value] of entries) document.set(key, value);
    const yaml = document.toString({ lineWidth: 0 }).replace(/\n$/, '');
    return `${bom}---${eol}${yaml.replace(/\n/g, eol)}${eol}---${eol}${source}`;
  }

  const openingEnd = source.indexOf('\n', parsed.range.start) + 1;
  const yamlEnd = parsed.range.closeStart;
  const yamlSource = source.slice(openingEnd, yamlEnd);
  let document: Document = parseDocument(yamlSource, { uniqueKeys: true, prettyErrors: true, strict: false });
  if (document.errors.length) throw new Error(`frontmatter 语法错误：${document.errors[0].message}`);
  if (!isMap(document.contents)) {
    if (Object.values(patches).every(value => value === null)) return source;
    document = new Document();
  }
  for (const [key, value] of Object.entries(patches)) {
    if (value === null) document.delete(key);
    else document.set(key, value);
  }
  const yaml = document.toString({ lineWidth: 0 }).replace(/\n$/, '').replace(/\n/g, eol);
  const closingHadEol = source[parsed.range.end - 1] === '\n';
  return `${source.slice(0, openingEnd)}${yaml}${eol}---${closingHadEol ? eol : ''}${source.slice(parsed.range.end)}`;
}
