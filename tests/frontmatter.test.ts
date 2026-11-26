import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, updateFrontmatter } from '../src/utils/frontmatter.ts';

test('frontmatter 保留 BOM、CRLF、注释和未知字段', () => {
  const source = '\uFEFF---\r\ntitle: 原始标题\r\nstatus: draft\r\n# 备注\r\ncustom: 42\r\n---\r\n正文\r\n';
  const parsed = parseFrontmatter(source);
  assert.equal(parsed.exists, true);
  assert.equal(parsed.data.title, '原始标题');
  assert.equal(parsed.body, '正文\r\n');

  const updated = updateFrontmatter(source, { title: '新标题', tags: ['写作', 'AI'] });
  assert.ok(updated.startsWith('\uFEFF---\r\n'));
  assert.match(updated, /# 备注/);
  assert.match(updated, /custom: 42/);
  assert.match(updated, /title: 新标题/);
  assert.match(updated, /status: draft/);
  assert.equal(updated.replace(/\r\n/g, '').includes('\n'), false);
});

test('frontmatter 支持创建、删除字段和原样正文', () => {
  const created = updateFrontmatter('第一行\n第二行\n', { title: '笔记', aliases: ['别名'] });
  assert.match(created, /^---\ntitle: 笔记\naliases:\n {2}- 别名\n---\n/);
  assert.ok(created.endsWith('第一行\n第二行\n'));

  const removed = updateFrontmatter(created, { aliases: null });
  assert.doesNotMatch(removed, /aliases:/);
  assert.equal(parseFrontmatter(removed).data.title, '笔记');
});

test('frontmatter 语法错误不会被结构化编辑静默覆盖', () => {
  const source = '---\ntitle: [未闭合\n---\n正文';
  const parsed = parseFrontmatter(source);
  assert.equal(parsed.exists, true);
  assert.ok(parsed.errors.length > 0);
  assert.throws(() => updateFrontmatter(source, { title: '覆盖' }), /frontmatter/i);
});

test('frontmatter 不把正文中的分隔线误认为元数据', () => {
  const parsed = parseFrontmatter('# 标题\n\n---\n\n正文');
  assert.equal(parsed.exists, false);
  assert.equal(parsed.body, '# 标题\n\n---\n\n正文');
});
