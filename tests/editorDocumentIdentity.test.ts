import test from 'node:test';
import assert from 'node:assert/strict';
import { isActiveEditorDocument } from '../src/utils/editorDocumentIdentity.ts';

function documentState(activeTabId: string, content: string) {
  return { activeTabId, content, tabs: [{ id: activeTabId, content }] };
}

test('accepts a controller for the active tab whose content matches the store', () => {
  assert.equal(isActiveEditorDocument('a', 'AAAA', documentState('a', 'AAAA')), true);
});

test('rejects the previous tab controller immediately after a tab switch', () => {
  assert.equal(isActiveEditorDocument('a', 'AAAA', documentState('b', 'BBBB')), false);
});

test('rejects an active-tab controller holding an older document snapshot', () => {
  assert.equal(isActiveEditorDocument('a', 'old', documentState('a', 'new')), false);
});
