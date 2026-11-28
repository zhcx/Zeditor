import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { EditorController } from '../src/types/editor.ts';

register('./helpers/resolveTypescript.mjs', import.meta.url);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => {} } });
const { useAppStore } = await import('../src/stores/appStore.ts');
const { useAIStore } = await import('../src/stores/aiStore.ts');

function tab(id: string, content: string) {
  return { id, title: id, path: null, content, modified: false };
}

test('AI acceptance falls back to the active document while an old controller is still published', () => {
  const a = tab('a', 'AAAA');
  const b = tab('b', 'BBBB');
  let dispatched = 0;
  const staleController = {
    tabId: 'a',
    getValue: () => 'AAAA',
    dispatch: () => { dispatched += 1; },
    focus: () => undefined,
  } as unknown as EditorController;
  useAppStore.setState({ tabs: [a, b], activeTabId: 'b', content: 'BBBB', editorView: staleController });
  useAIStore.getState().proposeEdit({ from: 0, to: 4, before: 'BBBB', after: 'AIBBBB', kind: 'replace' });
  useAIStore.getState().acceptPendingEdit();

  assert.equal(dispatched, 0);
  assert.equal(useAppStore.getState().tabs.find(item => item.id === 'a')?.content, 'AAAA');
  assert.equal(useAppStore.getState().tabs.find(item => item.id === 'b')?.content, 'AIBBBB');
  assert.equal(useAppStore.getState().content, 'AIBBBB');
  assert.equal(useAIStore.getState().status, 'success');

  useAppStore.setState({ tabs: [], activeTabId: null, content: '', editorView: null });
  useAIStore.setState({ pendingEdit: null, lastAppliedRound: null, status: 'idle', statusMessage: '' });
});
