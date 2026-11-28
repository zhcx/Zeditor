import test from 'node:test';
import assert from 'node:assert/strict';
import { KnowledgeIndexService } from '../src/services/knowledgeIndex.ts';

function tree(path: string, directories: string[] = [], files: string[] = []): unknown {
  return [
    ...directories.map(name => ({ name, path: `${path}/${name}`, isDirectory: true, children: [] })),
    ...files.map(name => ({ name, path: `${path}/${name}`, isDirectory: false })),
  ];
}

test('工作区扫描递归读取 Markdown 并跳过依赖目录', async () => {
  const calls: string[] = [];
  const paths: string[] = [];
  const service = new KnowledgeIndexService(async (command, args = {}) => {
    calls.push(command);
    if (command === 'read_folder_readonly') paths.push(String(args.path));
    if (command === 'read_folder_readonly') {
      const path = String(args.path);
      if (path === 'C:/vault') return tree(path, ['notes', 'node_modules'], ['root.md']);
      if (path === 'C:/vault/notes') return tree(path, [], ['alpha.md']);
      return [];
    }
    if (command === 'read_text_document') return { content: String(args.path).endsWith('alpha.md') ? '# Alpha' : '# Root', encoding: 'utf-8' };
    return undefined;
  });
  const result = await service.scan('C:/vault');
  assert.equal(result.errors.length, 0);
  assert.deepEqual(service.all().map(note => note.title), ['Alpha', 'Root']);
  assert.equal(calls.some(call => call === 'read_folder_readonly'), true);
  assert.equal(calls.includes('read_folder'), false);
  assert.equal(paths.includes('C:/vault/node_modules'), false);
});

test('保存和删除只增量更新单篇文档', async () => {
  const service = new KnowledgeIndexService();
  service.upsert('C:/vault/a.md', '# A');
  service.upsert('C:/vault/a.md', '# A2');
  assert.equal(service.all().length, 1);
  assert.equal(service.get('C:/vault/a.md')?.title, 'A2');
  service.rename('C:/vault/a.md', 'C:/vault/renamed.md');
  assert.equal(service.get('C:/vault/renamed.md')?.title, 'A2');
  service.remove('C:/vault/renamed.md');
  assert.equal(service.all().length, 0);
});

test('扫描期间的增量编辑不会被旧磁盘快照覆盖', async () => {
  let release!: (value: unknown) => void;
  const service = new KnowledgeIndexService(async (command, args = {}) => {
    if (command === 'read_folder_readonly' && args.path === 'C:/vault') return new Promise(resolve => { release = resolve; });
    if (command === 'read_folder_readonly') return [];
    return { content: '# 旧内容', encoding: 'utf-8' };
  });
  const scanning = service.scan('C:/vault');
  service.upsert('C:/vault/a.md', '# 最新内容');
  release(tree('C:/vault', [], ['a.md']));
  const result = await scanning;
  assert.equal(result.cancelled, true);
  assert.equal(service.get('C:/vault/a.md')?.title, '最新内容');
});

test('扫描超过 3000 篇时明确报告部分索引', async () => {
  const files = Array.from({ length: 3001 }, (_, index) => ({ name: `n-${index}.md`, path: `C:/vault/n-${index}.md`, isDirectory: false }));
  const service = new KnowledgeIndexService(async (command, args = {}) => {
    if (command === 'read_folder_readonly') return args.path === 'C:/vault' ? files : [];
    return { content: '# Note', encoding: 'utf-8' };
  });
  const result = await service.scan('C:/vault');
  assert.equal(result.scanned, 3000);
  assert.equal(result.truncated, true);
  assert.equal(service.all().length, 3000);
});

test('扫描取消后不发布部分结果', async () => {
  let release!: (value: unknown) => void;
  const service = new KnowledgeIndexService(async command => command === 'read_folder_readonly'
    ? new Promise(resolve => { release = resolve; })
    : { content: '# A', encoding: 'utf-8' });
  const scanning = service.scan('C:/vault');
  service.cancel();
  release(tree('C:/vault', [], ['a.md']));
  await scanning;
  assert.equal(service.all().length, 0);
});
