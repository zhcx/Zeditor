import test from 'node:test';
import assert from 'node:assert/strict';
import { createDailyNote, toggleMarkdownTask } from '../src/services/knowledgeActions.ts';

test('任务勾选使用检查后保存并拒绝外部冲突', async () => {
  const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
  const invoker = async <T,>(command: string, args: Record<string, unknown> = {}): Promise<T> => {
    calls.push({ command, args });
    if (command === 'read_text_document') return { content: '# A\n- [ ] 任务\n', encoding: 'utf-8', fileVersion: { size: 12, sha256: 'a' } } as T;
    if (command === 'save_file_content_checked') return { status: 'saved', fileVersion: { size: 12, sha256: 'b' }, current: null } as T;
    return undefined as T;
  };
  const result = await toggleMarkdownTask('C:/a.md', 2, true, invoker);
  assert.equal(result.content, '# A\n- [x] 任务\n');
  assert.equal(calls[1].command, 'save_file_content_checked');
  assert.equal((calls[1].args.expectedVersion as { sha256: string }).sha256, 'a');

  await assert.rejects(toggleMarkdownTask('C:/a.md', 2, true, async <T,>(command: string): Promise<T> => {
    if (command === 'read_text_document') return { content: '# A\n- [ ] 任务\n', encoding: 'utf-8', fileVersion: { size: 12, sha256: 'a' } } as T;
    return { status: 'conflict', fileVersion: { size: 12, sha256: 'external' }, current: null } as T;
  }), /外部修改|冲突/);
});

test('日记按日期创建且不覆盖已有文件', async () => {
  const writes: string[] = [];
  const invoker = async <T,>(command: string, args: Record<string, unknown> = {}): Promise<T> => {
    if (command === 'read_text_document') throw new Error('not found');
    if (command === 'create_file_exclusive') { writes.push(String(args.content)); return true as T; }
    return undefined as T;
  };
  const result = await createDailyNote('C:/vault', '2026-11-26', invoker);
  assert.equal(result.path.replace(/\\/g, '/'), 'C:/vault/daily/2026-11-26.md');
  assert.equal(result.created, true);
  assert.match(writes[0], /2026-11-26/);
});

test('非任务行不能被切换', async () => {
  await assert.rejects(toggleMarkdownTask('C:/a.md', 1, true, async <T,>() => ({ content: '普通文字', encoding: 'utf-8', fileVersion: { size: 4, sha256: 'a' } }) as T), /任务/);
});
