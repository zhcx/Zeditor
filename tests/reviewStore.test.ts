import test from 'node:test';
import assert from 'node:assert/strict';
import { useReviewStore } from '../src/stores/reviewStore.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

const storage = memoryStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

test('review comments persist per normalized path and reload after switching documents', () => {
  const store = useReviewStore.getState();
  store.setDocument('C:\\Work\\Note.md', 'tab-1', 'a word here');
  const id = store.addComment({ from: 2, to: 6 }, 'word', 'Please clarify');
  assert.ok(id);
  assert.equal(useReviewStore.getState().comments[useReviewStore.getState().documentKey]?.[0].quote, 'word');
  useReviewStore.getState().setDocument('other.md', 'tab-2', 'other');
  assert.equal(useReviewStore.getState().comments[store.documentKey], undefined);
  useReviewStore.getState().setDocument('c:/work/note.md', 'tab-1', 'a word here');
  assert.equal(useReviewStore.getState().comments[useReviewStore.getState().documentKey]?.[0].body, 'Please clarify');
  assert.ok(storage.values.has(`zeditor.review.${useReviewStore.getState().documentKey}`));
});

test('resolve, reopen and delete update persisted comments', () => {
  const store = useReviewStore.getState();
  store.setDocument('review-actions.md', 'tab-r', 'text here');
  const id = store.addComment({ from: 0, to: 4 }, 'text', 'note')!;
  useReviewStore.getState().setResolved(id, true);
  assert.equal(useReviewStore.getState().comments[useReviewStore.getState().documentKey]?.[0].resolved, true);
  useReviewStore.getState().setResolved(id, false);
  useReviewStore.getState().deleteComment(id);
  assert.deepEqual(useReviewStore.getState().comments[useReviewStore.getState().documentKey], []);
});

test('external content edits mark comments stale at their original anchor', () => {
  const store = useReviewStore.getState();
  store.setDocument('review-stale.md', 'tab-s', 'aaa word here');
  store.addComment({ from: 4, to: 8 }, 'word', 'note');
  useReviewStore.getState().revalidate('xxx changed');
  assert.equal(useReviewStore.getState().comments[useReviewStore.getState().documentKey]?.[0].stale, true);
});

test('empty JSON export still identifies the current document', () => {
  useReviewStore.getState().setDocument('empty-review.md', 'tab-empty', '');
  const payload = JSON.parse(useReviewStore.getState().exportComments()) as { documentKey: string; comments: unknown[] };
  assert.equal(payload.documentKey, 'file:empty-review.md');
  assert.deepEqual(payload.comments, []);
});

test('JSON export includes document identity, quote, state and author', () => {
  const store = useReviewStore.getState();
  store.setDocument('review-export.md', 'tab-e', 'hello world');
  store.addComment({ from: 0, to: 5 }, 'hello', 'note');
  const payload = JSON.parse(useReviewStore.getState().exportComments()) as { version: number; documentKey: string; comments: Array<Record<string, unknown>> };
  assert.equal(payload.version, 1);
  assert.equal(payload.documentKey, 'file:review-export.md');
  assert.equal(payload.comments[0].quote, 'hello');
  assert.equal(payload.comments[0].resolved, false);
  assert.equal(payload.comments[0].author, '我');
});
