import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeObsidianVault, notionHtmlToMarkdown, validateTyporaTheme } from '../src/utils/migration.ts';

test('Obsidian 分析识别附件、日记和未解析链接', () => {
  const report = analyzeObsidianVault([
    { path: '.obsidian/app.json', content: '{}' },
    { path: 'daily/2026-11-26.md', content: '# 日记\n[[Alpha]]' },
    { path: 'Alpha.md', content: '# Alpha' },
    { path: 'assets/image.png', content: '' },
  ]);
  assert.equal(report.markdownFiles, 2);
  assert.equal(report.attachments, 1);
  assert.equal(report.hasObsidianConfig, true);
  assert.equal(report.dailyNotes, 1);
  assert.equal(report.unresolvedLinks.length, 0);
});

test('Notion HTML 转为 Markdown 并移除脚本', () => {
  const markdown = notionHtmlToMarkdown('<h1>页面</h1><p>正文 <strong>重点</strong></p><script>alert(1)</script>');
  assert.match(markdown, /^# 页面/);
  assert.match(markdown, /\*\*重点\*\*/);
  assert.doesNotMatch(markdown, /alert/);
});

test('Typora 主题拒绝外部资源导入', () => {
  assert.match(validateTyporaTheme('body { color: #222; }'), /color/);
  assert.throws(() => validateTyporaTheme('@import url(https://example.com/a.css);'), /外部|import/);
});
