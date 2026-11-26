import test from 'node:test';
import assert from 'node:assert/strict';
import { importNotionHtml } from '../src/services/migrationImport.ts';

test('Notion HTML 导入为安全文件名且不覆盖已有 Markdown', async () => {
  const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
  const invoker = async <T,>(command: string, args: Record<string, unknown> = {}): Promise<T> => {
    calls.push({ command, args });
    if (command === 'read_folder') return [] as T;
    return false as T;
  };
  const result = await importNotionHtml('<h1>页面</h1><p>正文</p>', '目录/不安全:标题', 'C:/vault', invoker);
  assert.equal(result.created, false);
  assert.equal(result.path.replace(/\\/g, '/'), 'C:/vault/imported/目录-不安全-标题.md');
  assert.match(String(calls.at(-1)?.args.content), /^# 页面/);
});

test('Notion HTML 导入再次创建已有文件不会覆盖', async () => {
  const invoker = async <T,>(command: string): Promise<T> => command === 'read_folder' ? [] as T : true as T;
  const result = await importNotionHtml('<p>正文</p>', '页面', 'C:/vault', invoker);
  assert.equal(result.created, true);
});
