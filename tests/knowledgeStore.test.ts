import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });

const { createKnowledgeStore, createKnowledgeSelectors } = await import('../src/stores/knowledgeStore.ts');

function fixture() {
  const notes = new Map<string, Record<string, unknown>>();
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let scan = async (root: string) => {
    notes.set(`${root}/a.md`, { path: `${root}/a.md`, title: 'A', tags: ['work'], properties: { status: 'doing' }, tasks: [], links: [] });
    return { scanned: 1, errors: [] as string[] };
  };
  const index = {
    cancel: () => calls.push({ method: 'cancel', args: [] }),
    scan: (root: string) => { calls.push({ method: 'scan', args: [root] }); return scan(root); },
    upsert: (path: string, content: string) => {
      calls.push({ method: 'upsert', args: [path, content] });
      notes.set(path, { path, title: content, tags: [], properties: {}, tasks: [], links: [] });
    },
    all: () => [...notes.values()],
    get: (path: string) => notes.get(path),
    query: (filter: Record<string, unknown>) => [...notes.values()].filter(note => !filter.status || note.properties.status === filter.status),
    tasks: (filter: { done?: boolean; tag?: string } = {}) => [...notes.values()].flatMap(note => note.tasks).filter(task => filter.done === undefined || task.done === filter.done),
    calendar: (month: string) => [...notes.values()].filter(note => String(note.properties.due).startsWith(month)).map(note => ({ date: note.properties.due, note })),
    graph: () => ({ nodes: [...notes.values()].map(note => ({ id: note.path, title: note.title })), edges: [] }),
  };
  return { index, calls, notes, setScan: (next: typeof scan) => { scan = next; } };
}

test('根目录来自 workspace-roots，setRoot 去重、持久化并扫描', async () => {
  storage.set('zeditor.workspace-roots', JSON.stringify(['C:/vault']));
  const { index, calls } = fixture();
  const store = createKnowledgeStore(index);
  assert.deepEqual(store.getState().roots, ['C:/vault']);
  assert.equal(store.getState().activeRoot, 'C:/vault');
  const revision = store.getState().revision;
  await store.getState().setRoot(' C:/vault ');
  assert.deepEqual(store.getState().roots, ['C:/vault']);
  assert.equal(store.getState().activeRoot, 'C:/vault');
  assert.equal(store.getState().revision, revision + 1);
  assert.equal(store.getState().scanning, false);
  assert.equal(store.getState().error, null);
  assert.equal(calls.filter(call => call.method === 'scan').length, 1);
  assert.deepEqual(JSON.parse(storage.get('zeditor.workspace-roots')!), ['C:/vault']);
});

test('扫描暴露 loading，部分错误写入 error，失败不递增 revision', async () => {
  const { index, setScan } = fixture();
  let release!: (value: { scanned: number; errors: string[] }) => void;
  setScan(() => new Promise(resolve => { release = resolve; }));
  const store = createKnowledgeStore(index);
  const pending = store.getState().setRoot('C:/slow');
  assert.equal(store.getState().scanning, true);
  release({ scanned: 1, errors: ['C:/slow/b.md: denied'] });
  await pending;
  assert.match(store.getState().error!, /denied/);
  const revision = store.getState().revision;
  setScan(async () => { throw new Error('offline'); });
  await store.getState().scan('C:/slow');
  assert.match(store.getState().error!, /offline/);
  assert.equal(store.getState().revision, revision);
  assert.equal(store.getState().scanning, false);
});

test('扫描达到上限时显示部分索引提示', async () => {
  const { index, setScan } = fixture();
  setScan(async () => ({ scanned: 3000, errors: [], truncated: true }));
  const store = createKnowledgeStore(index);
  await store.getState().setRoot('C:/large');
  assert.match(store.getState().error!, /3000|上限|部分索引/);
  assert.equal(store.getState().scanning, false);
});

test('旧根目录的迟到扫描不会覆盖新根目录结果', async () => {
  const { index, setScan } = fixture();
  const releases = new Map<string, (value: { scanned: number; errors: string[] }) => void>();
  setScan(root => new Promise(resolve => { releases.set(root, resolve); }));
  const store = createKnowledgeStore(index);
  const first = store.getState().setRoot('C:/first');
  const second = store.getState().setRoot('C:/second');
  assert.equal(store.getState().activeRoot, 'C:/second');
  releases.get('C:/second')!({ scanned: 2, errors: [] });
  await second;
  const revision = store.getState().revision;
  releases.get('C:/first')!({ scanned: 99, errors: ['stale'] });
  await first;
  assert.equal(store.getState().activeRoot, 'C:/second');
  assert.equal(store.getState().revision, revision);
  assert.equal(store.getState().error, null);
  assert.equal(store.getState().scanning, false);
});

test('upsertCurrentContent 增量更新服务并递增 revision', () => {
  const { index, calls } = fixture();
  const store = createKnowledgeStore(index);
  const revision = store.getState().revision;
  store.getState().upsertCurrentContent('C:/vault/a.md', '# Changed');
  assert.equal(store.getState().revision, revision + 1);
  assert.equal(index.get('C:/vault/a.md')?.title, '# Changed');
  assert.deepEqual(calls.at(-1), { method: 'upsert', args: ['C:/vault/a.md', '# Changed'] });
  store.getState().upsertCurrentContent('', '# ignored');
  assert.equal(store.getState().revision, revision + 1);
});

test('selectors 按需查询索引，不在 Zustand state 中复制文档', async () => {
  const { index } = fixture();
  const store = createKnowledgeStore(index);
  await store.getState().setRoot('C:/vault');
  const selectors = createKnowledgeSelectors(index);
  const state = store.getState();
  assert.equal('documents' in state, false);
  assert.equal('notes' in state, false);
  const rows = selectors.selectDatabase(state, { status: 'doing' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0], index.get('C:/vault/a.md'));
  assert.equal(selectors.selectTasks(state, { done: false }).length, 0);
  assert.equal(selectors.selectCalendar(state, '2026-11').length, 0);
  assert.equal(selectors.selectGraph(state).nodes.length, 1);
});
