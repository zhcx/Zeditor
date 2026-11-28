import test from 'node:test';
import assert from 'node:assert/strict';
import { filterKnowledgeNotes } from '../src/utils/knowledgeSearch.ts';
import type { NoteMetadata } from '../src/utils/metadataIndex.ts';

const note = {
  path: 'notes/alpha.md', title: 'Alpha 写作', aliases: ['甲'], tags: ['writing'],
  properties: { status: 'active' }, headings: [], links: [], tasks: [], searchText: '讨论 Markdown 编辑器', modifiedAt: null,
} as NoteMetadata;

test('知识库搜索匹配标题、路径、标签、属性和正文', () => {
  assert.equal(filterKnowledgeNotes([note], '写作').length, 1);
  assert.equal(filterKnowledgeNotes([note], 'writing').length, 1);
  assert.equal(filterKnowledgeNotes([note], 'active').length, 1);
  assert.equal(filterKnowledgeNotes([note], 'Markdown').length, 1);
  assert.equal(filterKnowledgeNotes([note], '不存在').length, 0);
});
