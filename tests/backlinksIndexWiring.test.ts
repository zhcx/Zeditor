import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('反向链接优先使用增量索引并监听更新', () => {
  const source = readFileSync('src/components/Sidebar/BacklinksSection.tsx', 'utf8');
  assert.ok(/knowledgeIndexService\.backlinks/.test(source));
  assert.ok(/zeditor-knowledge-updated/.test(source));
  assert.ok(/find_wiki_backlinks/.test(source), '应保留未索引时的原生回退');
});
