import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

test('知识库 Tab 在窄侧栏使用完整网格且不横向滚动', () => {
  const css = read('src/styles/knowledge.css');
  const tabs = read('src/components/Knowledge/KnowledgeTabs.tsx');
  assert.match(css, /\.knowledge-tabs\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(css, /\.knowledge-tabs\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@container\s*\(min-width:\s*460px\)/);
  for (const label of ['数据库', '任务', '日历', '关系图', '属性', '迁移']) assert.ok(tabs.includes(label));
});

test('知识库默认状态提供目录选择、搜索、新建和概览', () => {
  const panel = read('src/components/Knowledge/KnowledgePanel.tsx') + read('src/components/Knowledge/KnowledgeSetup.tsx');
  assert.ok(panel.includes('KnowledgeSetup'));
  assert.ok(panel.includes('KnowledgeSearch'));
  assert.ok(panel.includes('KnowledgeSummary'));
  assert.ok(panel.includes('aria-label="搜索知识库"'));
  assert.ok(panel.includes('aria-label="新建笔记"'));
  assert.ok(panel.includes('aria-label="选择知识库文件夹"'));
  const database = read('src/components/Knowledge/DatabaseView.tsx');
  assert.ok(database.includes('toggleFavorite'));
  assert.ok(database.includes('name="star"'));
  assert.ok(read('src/components/Icons/iconGeometry.ts').includes('star:'));
});
