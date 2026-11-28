import { htmlToMarkdown } from './htmlToMarkdown.ts';
import { MetadataIndex, normalizeNotePath, parseNoteMetadata } from './metadataIndex.ts';

export interface MigrationFile { path: string; content: string }
export interface ObsidianMigrationReport {
  markdownFiles: number;
  attachments: number;
  hasObsidianConfig: boolean;
  dailyNotes: number;
  unresolvedLinks: Array<{ path: string; target: string }>;
  warnings: string[];
}

export function analyzeObsidianVault(files: readonly MigrationFile[]): ObsidianMigrationReport {
  const index = new MetadataIndex();
  let attachments = 0;
  let dailyNotes = 0;
  let hasObsidianConfig = false;
  for (const file of files) {
    const path = normalizeNotePath(file.path);
    if (path.startsWith('.obsidian/') && path.endsWith('.json')) hasObsidianConfig = true;
    if (/\.md$/i.test(path)) {
      index.upsert(parseNoteMetadata(path, file.content));
      if (/(?:^|\/)(?:daily|journal|日记)(?:\/|$)/i.test(path) || /(?:^|\/)\d{4}-\d{2}-\d{2}\.md$/i.test(path)) dailyNotes += 1;
    } else if (!path.startsWith('.obsidian/')) attachments += 1;
  }
  const unresolvedLinks = index.unresolvedLinks().map(({ source, link }) => ({ path: source.path, target: link.target }));
  const warnings: string[] = [];
  if (!hasObsidianConfig) warnings.push('未发现 .obsidian 配置；将按普通 Markdown 文件夹处理。');
  if (unresolvedLinks.length) warnings.push(`发现 ${unresolvedLinks.length} 个未解析 Wiki 链接。`);
  if (attachments) warnings.push(`发现 ${attachments} 个附件，请保留原目录结构。`);
  return { markdownFiles: index.all().length, attachments, hasObsidianConfig, dailyNotes, unresolvedLinks, warnings };
}

export function notionHtmlToMarkdown(html: string, title?: string): string {
  const markdown = htmlToMarkdown(html);
  if (!title?.trim() || /^#\s/.test(markdown)) return markdown;
  return `# ${title.trim()}\n\n${markdown}`;
}

/** 主题导入只接受本地 CSS，避免远程字体/图片追踪和外部依赖。 */
export function validateTyporaTheme(css: string): string {
  if (/@import\b/i.test(css)) throw new Error('主题包含外部 import，未导入');
  if (/url\(\s*['"]?(?:https?:)?\/\//i.test(css)) throw new Error('主题包含外部资源 URL，未导入');
  if (css.length > 2 * 1024 * 1024) throw new Error('主题文件超过 2 MiB');
  return css;
}
