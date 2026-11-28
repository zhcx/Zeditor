import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExternalEditorSource, resolveEditorControllerSurface } from '../src/utils/editorTransitionSafety.ts';
import type { EditorController } from '../src/types/editor.ts';
import type { WorkspaceMode } from '../src/utils/workspaceMode.ts';

const documentState = (activeTabId: string | null, content: string) => ({
  activeTabId,
  content,
  tabs: [{ id: activeTabId, content }],
});

test('external synchronization reads the latest active document instead of an older render snapshot', () => {
  const state = documentState('a', 'new content');
  assert.equal(resolveExternalEditorSource(state, 'a'), 'new content');
});

test('external synchronization rejects a render from a tab that is no longer active', () => {
  const state = documentState('b', 'tab B');
  assert.equal(resolveExternalEditorSource(state, 'a', 'tab A'), null);
});

test('external synchronization rejects inconsistent store snapshots', () => {
  const state = { activeTabId: 'a', content: 'top-level', tabs: [{ id: 'a', content: 'tab A' }] };
  assert.equal(resolveExternalEditorSource(state, 'a', 'old'), null);
});

test('controller surface ownership takes precedence over a mode awaiting React handoff', () => {
  const controller = { surface: 'wysiwyg', tabId: 'a' } as EditorController;
  assert.equal(resolveEditorControllerSurface('source', controller), 'wysiwyg');
  assert.equal(resolveEditorControllerSurface('wysiwyg', controller), 'wysiwyg');
});

test('a missing controller has no surface ownership', () => {
  assert.equal(resolveEditorControllerSurface('source', null), null);
});

test('legacy controllers fall back to the workspace mode surface', () => {
  const controller = { tabId: 'a' } as EditorController;
  assert.equal(resolveEditorControllerSurface('split' as WorkspaceMode, controller), 'source');
  assert.equal(resolveEditorControllerSurface('wysiwyg' as WorkspaceMode, controller), 'wysiwyg');
});
