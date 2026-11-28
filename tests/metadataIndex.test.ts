import test from 'node:test';
import assert from 'node:assert/strict';
import { MetadataIndex, parseNoteMetadata, suggestWikiTargets } from '../src/utils/metadataIndex.ts';

const alpha = `---\ntitle: Alpha\naliases: [甲]\ntags: [writing, ai]\nstatus: active\ndue: 2026-12-01\n---\n# Alpha\n- [ ] 完成审阅 📅 2026-12-02 #writing\n见 [[Beta]] 和 [[Missing]].\n`;
const beta = `---\ntitle: Beta\ntags: writing\nstatus: done\n---\n# Beta\n[[Alpha]]\n`;

test('解析笔记元数据、任务和链接', () => {
  const note = parseNoteMetadata('notes/alpha.md', alpha);
  assert.equal(note.title, 'Alpha');
  assert.deepEqual(note.aliases, ['甲']);
  assert.deepEqual(note.tags, ['writing', 'ai']);
  assert.equal(note.properties.status, 'active');
  assert.equal(note.links[0].target, 'Beta');
  assert.match(note.links[0].excerpt, /Beta/);
  assert.equal(note.tasks[0].done, false);
  assert.equal(note.tasks[0].due, '2026-12-02');
});

test('增量索引支持重命名、删除、反链和未链接提及', () => {
  const index = new MetadataIndex();
  index.upsert(parseNoteMetadata('notes/alpha.md', alpha));
  index.upsert(parseNoteMetadata('notes/beta.md', beta));
  assert.equal(index.backlinks('notes/alpha.md').length, 1);
  assert.equal(index.unresolvedLinks().length, 1);
  assert.equal(index.suggest('甲', 'notes/new.md')[0].path, 'notes/alpha.md');
  index.upsert(parseNoteMetadata('notes/gamma.md', '# Gamma\nAlpha 是这份笔记的主角。\n'));
  assert.equal(index.unlinkedMentions('notes/alpha.md')[0].path, 'notes/gamma.md');

  index.upsert(parseNoteMetadata('notes/beta-renamed.md', beta));
  index.remove('notes/beta.md');
  assert.equal(index.get('notes/beta.md'), undefined);
  assert.equal(index.backlinks('notes/alpha.md')[0].path, 'notes/beta-renamed.md');
});

test('数据库查询按属性筛选并汇总任务', () => {
  const index = new MetadataIndex();
  index.upsert(parseNoteMetadata('notes/alpha.md', alpha));
  index.upsert(parseNoteMetadata('notes/beta.md', beta));
  assert.deepEqual(index.query({ status: 'active' }).map(note => note.path), ['notes/alpha.md']);
  assert.equal(index.tasks({ tag: 'writing' }).length, 1);
  assert.equal(index.calendar('2026-12').length, 2);
});

test('Wiki 补全过滤当前文档并支持别名', () => {
  const notes = [parseNoteMetadata('notes/alpha.md', alpha), parseNoteMetadata('notes/beta.md', beta)];
  assert.equal(suggestWikiTargets(notes, '甲', 'notes/alpha.md').length, 0);
  assert.equal(suggestWikiTargets(notes, 'be', 'notes/new.md')[0].title, 'Beta');
});
