import test from 'node:test';
import assert from 'node:assert/strict';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
} });
const { useWorkspaceLayoutStore } = await import('../src/stores/workspaceLayoutStore.ts');

test('基础分栏状态选择不同标签并限制比例', () => {
  useWorkspaceLayoutStore.getState().enableSplit('tab-b');
  assert.equal(useWorkspaceLayoutStore.getState().enabled, true);
  assert.equal(useWorkspaceLayoutStore.getState().secondaryTabId, 'tab-b');
  useWorkspaceLayoutStore.getState().setRatio(2);
  assert.equal(useWorkspaceLayoutStore.getState().ratio, 0.75);
  useWorkspaceLayoutStore.getState().setRatio(-1);
  assert.equal(useWorkspaceLayoutStore.getState().ratio, 0.25);
});

test('分栏方向与选择持久化，关闭后保留选择', () => {
  const store = useWorkspaceLayoutStore.getState();
  store.setOrientation('vertical');
  store.setSecondaryTab('tab-c');
  store.disableSplit();
  assert.equal(useWorkspaceLayoutStore.getState().enabled, false);
  assert.equal(useWorkspaceLayoutStore.getState().secondaryTabId, 'tab-c');
  assert.equal(JSON.parse(values.get('zeditor.workspace-layout.v1')!).orientation, 'vertical');
});
