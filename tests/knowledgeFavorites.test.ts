import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });
const { createKnowledgeStore } = await import('../src/stores/knowledgeStore.ts');

function fixture() {
  return createKnowledgeStore({
    all: () => [], get: () => undefined, query: () => [], tasks: () => [], calendar: () => [], graph: () => ({ nodes: [], edges: [] }),
    upsert: () => {}, scan: async () => ({ scanned: 0, errors: [] }),
  });
}

test('知识库收藏按路径持久化且可切换', () => {
  const store = fixture();
  store.getState().toggleFavorite('C:/vault/a.md');
  assert.deepEqual(store.getState().favorites, ['C:/vault/a.md']);
  store.getState().toggleFavorite('C:/vault/a.md');
  assert.deepEqual(store.getState().favorites, []);
  store.getState().toggleFavorite('C:/vault/a.md');
  assert.deepEqual(JSON.parse(storage.get('zeditor.knowledge-favorites.v1')!), ['C:/vault/a.md']);
});
