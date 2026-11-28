import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnowledgeNote } from '../src/services/knowledgeActions.ts';

test('新建笔记清理文件名并通过排他命令创建', async () => {
  const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
  const invoker = async <T,>(command: string, args: Record<string, unknown> = {}): Promise<T> => {
    calls.push({ command, args });
    if (command === 'create_file_exclusive') return true as T;
    return undefined as T;
  };
  const result = await createKnowledgeNote('C:/vault', '目录/不安全:标题', invoker);
  assert.equal(result.path.replace(/\\/g, '/'), 'C:/vault/目录-不安全-标题.md');
  assert.equal(result.created, true);
  assert.equal(calls[0].command, 'read_folder');
  assert.equal(calls[1].command, 'create_file_exclusive');
  assert.match(String(calls[1].args.content), /^# 目录-不安全-标题\n\n/);
});

test('新建笔记不会覆盖已有文件', async () => {
  const invoker = async <T,>(command: string): Promise<T> => {
    if (command === 'create_file_exclusive') return false as T;
    return undefined as T;
  };
  await assert.rejects(createKnowledgeNote('C:/vault', '已存在', invoker), /已存在|覆盖/);
});
