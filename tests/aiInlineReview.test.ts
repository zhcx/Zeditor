import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import type { EditorController } from '../src/types/editor.ts';

register('./helpers/resolveTypescript.mjs', import.meta.url);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => {} } });
const { useAIStore } = await import('../src/stores/aiStore.ts');
const { useAppStore } = await import('../src/stores/appStore.ts');

function installEditor(initial: string) {
  let content = initial;
  let revision = 1;
  const calls: Array<{ from: number; to: number; text: string }> = [];
  const undo = () => {
    content = content === 'red GREEN blue' ? 'red green blue' : content;
    useAppStore.setState(state => ({ content, tabs: state.tabs.map(tab => tab.id === 'tab-ai' ? { ...tab, content } : tab) }));
  };
  const editor = {
    tabId: 'tab-ai',
    getValue: () => content,
    getRevision: () => revision,
    getSelection: () => ({ from: 4, to: 4, empty: true }),
    dispatch: (spec: { changes?: { from: number; to: number; insert: string } }) => {
      const change = spec.changes;
      if (!change) return;
      calls.push({ from: change.from, to: change.to, text: change.insert });
      content = content.slice(0, change.from) + change.insert + content.slice(change.to);
      revision += 1;
      useAppStore.setState(state => ({ content, tabs: state.tabs.map(tab => tab.id === 'tab-ai' ? { ...tab, content } : tab) }));
    },
    focus: () => undefined,
    undo,
  } as unknown as EditorController;
  useAppStore.setState({ activeTabId: 'tab-ai', content, tabs: [{ id: 'tab-ai', content }] as never, editorView: editor });
  useAIStore.setState({ pendingEdit: null, lastAppliedRound: null, editMode: 'suggest', ghostText: null } as never);
  return { calls, get content() { return content; }, undoCalls: () => undefined };
}

test('proposing AI diff does not mutate content; per-hunk accept uses one editor operation', () => {
  const editor = installEditor('red green blue');
  useAIStore.getState().proposeEdit({ kind: 'polish', reason: 'test', before: 'red green blue', after: 'red GREEN blue', from: 0, to: 14 });
  assert.equal(editor.content, 'red green blue');
  assert.equal(useAIStore.getState().pendingEdit?.hunks?.length, 1);
  useAIStore.getState().acceptPendingHunk(useAIStore.getState().pendingEdit!.hunks![0].id);
  assert.equal(editor.content, 'red GREEN blue');
  assert.equal(editor.calls.length, 1);
  useAIStore.getState().undoLastAiRound();
  assert.equal(editor.content, 'red green blue');
  assert.equal(useAIStore.getState().lastAppliedRound, null);
});

test('multiple hunks can be accepted independently against the latest document', () => {
  const editor = installEditor('red green blue');
  useAIStore.getState().proposeEdit({ kind: 'polish', reason: 'test', before: 'red green blue', after: 'RED GREEN BLUE', from: 0, to: 14 });
  const first = useAIStore.getState().pendingEdit!.hunks![0];
  useAIStore.getState().acceptPendingHunk(first.id);
  assert.equal(editor.content, 'RED green blue');
  const second = useAIStore.getState().pendingEdit!.hunks![0];
  useAIStore.getState().acceptPendingHunk(second.id);
  assert.equal(editor.content, 'RED GREEN blue');
  assert.equal(editor.calls.length, 2);
});

test('length-changing hunks accept sequentially without shifting later edits', () => {
  const editor = installEditor('red green blue');
  useAIStore.getState().proposeEdit({ kind: 'polish', reason: 'test', before: 'red green blue', after: 'red VERY green blue EXTRA', from: 0, to: 14 });
  useAIStore.getState().acceptPendingHunk(useAIStore.getState().pendingEdit!.hunks![0].id);
  assert.equal(editor.content, 'red VERY green blue');
  useAIStore.getState().acceptPendingHunk(useAIStore.getState().pendingEdit!.hunks![0].id);
  assert.equal(editor.content, 'red VERY green blue EXTRA');
  assert.equal(editor.calls.length, 2);
});

test('rejecting one hunk preserves text and never invokes the editor', () => {
  const editor = installEditor('red green blue');
  useAIStore.getState().proposeEdit({ kind: 'polish', reason: 'test', before: 'red green blue', after: 'RED green BLUE', from: 0, to: 14 });
  const first = useAIStore.getState().pendingEdit!.hunks![0];
  useAIStore.getState().rejectPendingHunk(first.id);
  assert.equal(editor.content, 'red green blue');
  assert.equal(editor.calls.length, 0);
  assert.deepEqual(useAIStore.getState().pendingEdit?.hunks?.map(h => h.before), ['blue']);
});

test('stale snapshot or revision refuses all writes and expires the proposal', () => {
  const editor = installEditor('red green blue');
  useAIStore.getState().proposeEdit({ kind: 'polish', reason: 'test', before: 'red green blue', after: 'red GREEN blue', from: 0, to: 14 });
  useAppStore.setState({ content: 'user changed text' });
  useAIStore.getState().acceptPendingHunk(useAIStore.getState().pendingEdit!.hunks![0].id);
  assert.equal(editor.calls.length, 0);
  assert.equal(useAIStore.getState().pendingEdit, null);
  assert.match(useAIStore.getState().statusMessage, /文档已变化/);
});

test('ghost acceptance inserts only at its generation cursor and revision, then clears', () => {
  const editor = installEditor('red green blue');
  useAIStore.getState().setCompanionVisible(true, { x: 0, y: 0 }, 4);
  useAIStore.getState().setGhostSuggestion(' GHOST');
  assert.equal(editor.content, 'red green blue');
  assert.equal(useAIStore.getState().acceptGhostText(), true);
  assert.equal(editor.content, 'red GHOSTgreen blue');
  assert.equal(editor.calls.length, 1);
  assert.equal(useAIStore.getState().ghostText, null);
});

test('ghost acceptance refuses cursor drift and stale revision', () => {
  const editor = installEditor('red green blue');
  useAIStore.getState().setCompanionVisible(true, { x: 0, y: 0 }, 4);
  useAIStore.getState().setGhostSuggestion(' GHOST');
  useAIStore.setState({ ghostText: { ...useAIStore.getState().ghostText!, revision: 99 } } as never);
  assert.equal(useAIStore.getState().acceptGhostText(), false);
  assert.equal(editor.calls.length, 0);
});

test('both editor adapters expose non-mutating review decorations and early Tab handling', async () => {
  const [source, wysiwyg, session, panel, activity, sidebar, app, menu] = await Promise.all([
    readFile(new URL('../src/components/Editor/Editor.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/Wysiwyg/WysiwygEditor.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/Wysiwyg/wysiwygSession.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/AI/AIDiffConfirmDialog.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ActivityBar/ActivityBar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/Sidebar/Sidebar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/MenuBar/MenuBar.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /setReviewDecorations/);
  assert.match(source, /canAcceptGhostText[\s\S]*?acceptGhostText/);
  assert.match(wysiwyg, /setReviewDecorations/);
  assert.match(wysiwyg, /selectionchange', syncGhost/);
  assert.match(wysiwyg, /wysiwyg-review-layer|setGhostText/);
  assert.match(session, /getContentRevision\(\)/);
  assert.doesNotMatch(session, /getRevision\(\)[^\n]*renderRevision/);
  assert.match(panel, /acceptPendingHunk/);
  assert.match(panel, /rejectPendingHunk/);
  assert.match(activity, /onSelectView\('review'\)/);
  assert.match(sidebar, /ReviewPanel/);
  assert.match(app, /zeditor-add-review-note/);
  assert.match(menu, /zeditor-add-review-note/);
});
