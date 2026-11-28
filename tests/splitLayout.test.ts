import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('分栏外壳占满主工作区且启用后清除旧错误状态', () => {
  const css = readFileSync('src/styles/splitWorkspace.css', 'utf8');
  assert.match(css, /\.split-editor-shell\s*\{[^}]*flex:\s*1/s);
  const app = readFileSync('src/App.tsx', 'utf8');
  const block = app.slice(app.indexOf('const toggleSplit'), app.indexOf('const insertPluginText'));
  assert.match(block, /layout\.enableSplit[\s\S]*?setStatus\('idle'/);
});
