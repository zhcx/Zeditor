import { invoke } from '@tauri-apps/api/core';
import { notionHtmlToMarkdown } from '../utils/migration.ts';
import { knowledgeIndexService } from './knowledgeIndex.ts';

type Invoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export async function importNotionHtml(html: string, title: string, root: string, invoker: Invoker = invoke as Invoker): Promise<{ path: string; created: boolean }> {
  const safeTitle = [...title].map(character => character.charCodeAt(0) < 32 ? '-' : character).join('')
    .replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '') || 'Notion 页面';
  const path = `${root.replace(/[\\/]+$/, '')}/imported/${safeTitle}.md`;
  const content = notionHtmlToMarkdown(html, safeTitle);
  await invoker('read_folder', { path: root }).catch(() => []);
  const created = await invoker<boolean>('create_file_exclusive', { path, content });
  if (created) knowledgeIndexService.upsert(path, content);
  return { path, created };
}
