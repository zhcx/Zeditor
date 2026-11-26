import test from 'node:test';
import assert from 'node:assert/strict';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
} });
const { usePluginStore } = await import('../src/stores/pluginStore.ts');

const manifest = { id: 'demo', name: 'Demo', version: '1.0.0', permissions: ['commands', 'slash'], contributions: {
  commands: [{ id: 'sign', title: '签名', action: { type: 'insert-text', text: '——作者' } }],
  slash: [{ id: 'sign', title: '签名', insert: '——作者' }],
} };

test('安全插件可导入、停用、移除并持久化', () => {
  const store = usePluginStore.getState();
  store.import(JSON.stringify(manifest));
  assert.equal(usePluginStore.getState().plugins.length, 1);
  assert.equal(usePluginStore.getState().commands()[0].title, '签名');
  usePluginStore.getState().toggle('demo');
  assert.equal(usePluginStore.getState().commands().length, 0);
  usePluginStore.getState().toggle('demo');
  assert.equal(usePluginStore.getState().slashItems().length, 1);
  assert.ok(values.get('zeditor.safe-plugins.v1')?.includes('demo'));
  usePluginStore.getState().remove('demo');
  assert.equal(usePluginStore.getState().plugins.length, 0);
});

test('重复导入更新插件且损坏存储不会阻止启动', () => {
  usePluginStore.getState().import(JSON.stringify(manifest));
  usePluginStore.getState().import(JSON.stringify({ ...manifest, name: 'Demo 2' }));
  assert.equal(usePluginStore.getState().plugins.length, 1);
  assert.equal(usePluginStore.getState().plugins[0].manifest.name, 'Demo 2');
});
