import { parseFrontmatter } from './frontmatter.ts';
import { parseMarkdownHeadings } from './markdownOutline.ts';
import { parseWikiLink } from './wikiLinks.ts';

export interface NoteLink {
  target: string;
  anchor: string | null;
  label: string | null;
  embed: boolean;
  line: number;
  excerpt: string;
}

export interface NoteTask {
  text: string;
  done: boolean;
  due: string | null;
  tags: string[];
  path: string;
  line: number;
}

export interface NoteMetadata {
  path: string;
  title: string;
  aliases: string[];
  tags: string[];
  properties: Record<string, unknown>;
  headings: ReturnType<typeof parseMarkdownHeadings>;
  links: NoteLink[];
  tasks: NoteTask[];
  /** 有限的正文检索文本，用于未链接提及；不保存整篇原文。 */
  searchText: string;
  modifiedAt: number | null;
}

export interface NoteQuery {
  status?: unknown;
  tag?: string;
  property?: string;
  equals?: unknown;
}

export function normalizeNotePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function noteBasename(path: string): string {
  return normalizeNotePath(path).split('/').pop()!.replace(/\.md$/i, '');
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,，\s]+/).map(item => item.trim()).filter(Boolean);
  return [];
}

function bodyLines(source: string, body: string): { lines: string[]; offset: number } {
  const offset = source.length - body.length;
  const before = source.slice(0, offset);
  return { lines: body.split(/\r?\n/), offset: before.split(/\r?\n/).length - 1 };
}

/** 从 Markdown 提取供链接、任务、数据库和图谱共用的元数据。 */
export function parseNoteMetadata(path: string, source: string, modifiedAt: number | null = null): NoteMetadata {
  const normalizedPath = normalizeNotePath(path);
  const frontmatter = parseFrontmatter(source);
  const properties = frontmatter.data;
  const aliases = stringList(properties.aliases ?? properties.alias);
  const { lines, offset } = bodyLines(source, frontmatter.body);
  const headings = parseMarkdownHeadings(frontmatter.body).map(heading => ({ ...heading, line: heading.line + offset }));
  const title = typeof properties.title === 'string' && properties.title.trim()
    ? properties.title.trim()
    : headings[0]?.text || noteBasename(normalizedPath);
  const links: NoteLink[] = [];
  const tasks: NoteTask[] = [];
  const bodyTags = new Set<string>();
  let fence: string | null = null;

  lines.forEach((line, index) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
      return;
    }
    if (fence) return;

    for (const match of line.matchAll(/(!?)\[\[([^[\]\r\n]+)\]\]/g)) {
      const parts = parseWikiLink(match[2]);
      if (!parts) continue;
      links.push({ ...parts, embed: match[1] === '!', line: index + 1 + offset, excerpt: line.trim().slice(0, 240) });
    }
    for (const match of line.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)) bodyTags.add(match[1]);
    const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
    if (task) {
      const text = task[2];
      const due = text.match(/(?:📅\s*|@due(?:\(|:)?\s*)(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;
      tasks.push({
        text: text.replace(/\s*(?:📅|@due(?:\(|:)?\s*)\d{4}-\d{2}-\d{2}\)?/gi, '').trim(),
        done: task[1].toLowerCase() === 'x',
        due,
        tags: [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map(match => match[1]),
        path: normalizedPath,
        line: index + 1 + offset,
      });
    }
  });

  return {
    path: normalizedPath,
    title,
    aliases,
    tags: [...new Set([...stringList(properties.tags ?? properties.tag), ...bodyTags])],
    properties,
    headings,
    links,
    tasks,
    searchText: frontmatter.body.replace(/[#*_`[\]]/g, ' ').slice(0, 50_000),
    modifiedAt,
  };
}

function resolveLink(index: MetadataIndex, from: NoteMetadata, target: string): NoteMetadata | null {
  if (!target) return from;
  const normalized = normalizeNotePath(target).replace(/\.md$/i, '');
  const slash = normalized.includes('/');
  if (slash) {
    const combined = normalizeNotePath(`${from.path.split('/').slice(0, -1).join('/')}/${normalized}`);
    const exact = index.get(combined) ?? index.get(normalized);
    if (exact) return exact;
  }
  const lower = normalized.toLocaleLowerCase();
  return index.all().find(note => !slash && (
    noteBasename(note.path).toLocaleLowerCase() === lower
    || note.title.toLocaleLowerCase() === lower
    || note.aliases.some(alias => alias.toLocaleLowerCase() === lower)
  )) ?? null;
}

export function suggestWikiTargets(notes: readonly NoteMetadata[], query: string, currentPath?: string): NoteMetadata[] {
  const needle = query.trim().toLocaleLowerCase();
  return notes
    .filter(note => note.path !== currentPath)
    .map(note => {
      const names = [note.title, noteBasename(note.path), ...note.aliases];
      const score = names.some(name => name.toLocaleLowerCase() === needle) ? 0
        : names.some(name => name.toLocaleLowerCase().startsWith(needle)) ? 1
          : names.some(name => name.toLocaleLowerCase().includes(needle)) ? 2 : 3;
      return { note, score };
    })
    .filter(item => item.score < 3)
    .sort((a, b) => a.score - b.score || a.note.title.localeCompare(b.note.title))
    .map(item => item.note);
}

/** 内存增量索引；文件保存、打开、重命名和删除时更新单篇文档。 */
export class MetadataIndex {
  private documents = new Map<string, NoteMetadata>();

  all(): NoteMetadata[] {
    return [...this.documents.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  get(path: string): NoteMetadata | undefined {
    return this.documents.get(normalizeNotePath(path));
  }

  upsert(note: NoteMetadata): void {
    this.documents.set(normalizeNotePath(note.path), { ...note, path: normalizeNotePath(note.path) });
  }

  remove(path: string): void {
    this.documents.delete(normalizeNotePath(path));
  }

  suggest(query: string, currentPath?: string): NoteMetadata[] {
    return suggestWikiTargets(this.all(), query, currentPath);
  }

  clear(): void {
    this.documents.clear();
  }

  backlinks(path: string) {
    const target = this.get(path);
    if (!target) return [];
    return this.all().flatMap(note => note.links
      .filter(link => resolveLink(this, note, link.target)?.path === target.path)
      .map(link => ({ ...note, link })));
  }

  unresolvedLinks() {
    return this.all().flatMap(note => note.links
      .filter(link => !resolveLink(this, note, link.target))
      .map(link => ({ source: note, link })));
  }

  unlinkedMentions(path: string): NoteMetadata[] {
    const target = this.get(path);
    if (!target) return [];
    const names = [target.title, noteBasename(target.path), ...target.aliases].filter(Boolean);
    return this.all().filter(note => note.path !== target.path && !note.links.some(link => resolveLink(this, note, link.target)?.path === target.path)
      && names.some(name => note.searchText.toLocaleLowerCase().includes(name.toLocaleLowerCase())));
  }

  query(query: NoteQuery): NoteMetadata[] {
    return this.all().filter(note => {
      if (query.status !== undefined && note.properties.status !== query.status) return false;
      if (query.tag && !note.tags.includes(query.tag)) return false;
      if (query.property && query.equals !== undefined && note.properties[query.property] !== query.equals) return false;
      return true;
    });
  }

  tasks(filter: { tag?: string; done?: boolean } = {}): NoteTask[] {
    return this.all().flatMap(note => note.tasks).filter(task => {
      if (filter.tag && !task.tags.includes(filter.tag)) return false;
      if (filter.done !== undefined && task.done !== filter.done) return false;
      return true;
    });
  }

  calendar(month: string): Array<{ date: string; note: NoteMetadata; task?: NoteTask }> {
    const entries: Array<{ date: string; note: NoteMetadata; task?: NoteTask }> = [];
    for (const note of this.all()) {
      const due = typeof note.properties.due === 'string' ? note.properties.due : typeof note.properties.date === 'string' ? note.properties.date : null;
      if (due?.startsWith(month)) entries.push({ date: due.slice(0, 10), note });
      for (const task of note.tasks) if (task.due?.startsWith(month)) entries.push({ date: task.due, note, task });
    }
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  graph() {
    const nodes = this.all().map(note => ({ id: note.path, title: note.title, tags: note.tags }));
    const edges = this.all().flatMap(note => note.links.flatMap(link => {
      const target = resolveLink(this, note, link.target);
      return target ? [{ source: note.path, target: target.path }] : [];
    }));
    return { nodes, edges: [...new Map(edges.map(edge => [`${edge.source}\0${edge.target}`, edge])).values()] };
  }
}
