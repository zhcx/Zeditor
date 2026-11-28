import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalHistoryService, documentIdForPath } from '../src/services/localHistory.ts';

test('文档身份忽略路径分隔符和 Windows 盘符大小写', () => {
  assert.equal(documentIdForPath('C:\\Notes\\A.md', 'win32'), documentIdForPath('c:/notes/a.md', 'win32'));
  assert.notEqual(documentIdForPath('C:/Notes/A.md', 'win32'), documentIdForPath('C:/Notes/B.md', 'win32'));
  assert.notEqual(documentIdForPath('/notes/A.md', 'linux'), documentIdForPath('/notes/a.md', 'linux'));
});

test('本地历史服务使用独立 Tauri 命令并传递编码', async () => {
  const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
  const service = createLocalHistoryService(async (command, args) => {
    calls.push({ command, args });
    if (command === 'local_history_record') return { versionId: 'v1', documentId: 'doc', path: 'C:/a.md', createdAt: '2026-01-01T00:00:00Z', sha256: 'hash', size: 2, encoding: 'utf-8', label: '保存' };
    if (command === 'local_history_list') return [];
    if (command === 'local_history_read') return { entry: { versionId: 'v1' }, content: '旧内容' };
    return undefined;
  });
  const entry = await service.record('doc', 'C:/a.md', '正文', 'utf-8', '保存');
  assert.equal(entry.versionId, 'v1');
  assert.deepEqual(await service.list('doc'), []);
  assert.equal((await service.read('doc', 'v1')).content, '旧内容');
  await service.remove('doc', 'v1');
  await service.migrate('old', 'new', 'C:/new.md');
  assert.deepEqual(calls.map(call => call.command), ['local_history_record', 'local_history_list', 'local_history_read', 'local_history_delete', 'local_history_migrate']);
  assert.equal(calls[0].args.encoding, 'utf-8');
});
