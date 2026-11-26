import { invoke } from '@tauri-apps/api/core';
import { knowledgeIndexService } from './knowledgeIndex.ts';

interface TextDocument { content: string; encoding: string; fileVersion?: { size: number; sha256: string } | null }
interface CheckedSave { status: 'saved' | 'conflict'; fileVersion?: { size: number; sha256: string } | null; current?: TextDocument | null }
type Invoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export async function toggleMarkdownTask(path: string, lineNumber: number, done: boolean, invoker: Invoker = invoke as Invoker): Promise<{ content: string }> {
  const document = await invoker<TextDocument>('read_text_document', { path });
  const lines = document.content.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const index = lineNumber - 1;
  const line = lines[index];
  if (!line || !/^\s*[-*+]\s+\[[ xX]\]\s+/.test(line)) throw new Error('这一行不是可切换的任务');
  lines[index] = line.replace(/^(\s*[-*+]\s+\[)[ xX](\]\s+)/, `$1${done ? 'x' : ' '}$2`);
  const content = lines.join('');
  const result = await invoker<CheckedSave>('save_file_content_checked', {
    path,
    content,
    encoding: document.encoding,
    expectedVersion: document.fileVersion ?? null,
  });
  if (result.status !== 'saved') throw new Error('文件已被外部修改，任务未保存。请刷新后重试。');
  knowledgeIndexService.upsert(path, content);
  return { content };
}

export async function createDailyNote(root: string, date: string, invoker: Invoker = invoke as Invoker): Promise<{ path: string; created: boolean }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error('日记日期无效');
  const path = `${root.replace(/[\\/]+$/, '')}/daily/${date}.md`;
  try {
    await invoker<TextDocument>('read_text_document', { path });
    return { path, created: false };
  } catch { /* 不存在时创建 */ }
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  const content = `# ${date} ${weekday}\n\n## 今日重点\n\n- [ ] \n\n## 记录\n\n## 明日计划\n\n- [ ] \n`;
  await invoker('read_folder', { path: root }).catch(() => []);
  const created = await invoker<boolean>('create_file_exclusive', { path, content });
  if (!created) return { path, created: false };
  knowledgeIndexService.upsert(path, content);
  return { path, created: true };
}
