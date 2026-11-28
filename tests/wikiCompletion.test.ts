import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWikiCompletions, wikiCompletionQuery } from '../src/utils/wikiCompletion.ts';
import type { NoteMetadata } from '../src/utils/metadataIndex.ts';

const notes: Array<Pick<NoteMetadata, 'path' | 'title' | 'aliases'>> = [
  { path: 'notes/alpha.md', title: 'Alpha', aliases: ['甲'] },
  { path: 'notes/beta.md', title: 'Beta', aliases: [] },
];

test('Wiki 补全识别光标前的 [[ 查询', () => {
  assert.deepEqual(wikiCompletionQuery('见 [[Al', 7), { from: 3, to: 7, query: 'Al' });
  assert.equal(wikiCompletionQuery('普通 [Al', 7), null);
});

test('Wiki 补全按标题和别名筛选并排除当前文档', () => {
  const items = buildWikiCompletions(notes, '甲', 'notes/alpha.md', { startLineNumber: 1, endLineNumber: 1, startColumn: 4, endColumn: 7 });
  assert.equal(items.length, 0);
  const beta = buildWikiCompletions(notes, 'be', 'notes/alpha.md', { startLineNumber: 1, endLineNumber: 1, startColumn: 4, endColumn: 7 });
  assert.equal(beta[0].label, 'Beta');
  assert.equal(beta[0].insertText, '[[Beta]]');
});
