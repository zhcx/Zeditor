import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('命令面板提供分栏、知识、历史、项目配置和安全插件入口', () => {
  const source = readFileSync('src/components/DocumentSwitcher/DocumentSwitcher.tsx', 'utf8');
  assert.ok(/zeditor-toggle-split/.test(source));
  assert.ok(/zeditor-open-knowledge/.test(source));
  assert.ok(/zeditor-open-history/.test(source));
  assert.ok(/project_context/.test(source));
  assert.ok(/extensions/.test(source));
});

test('命令面板执行启用插件的白名单动作', () => {
  const source = readFileSync('src/components/DocumentSwitcher/DocumentSwitcher.tsx', 'utf8');
  assert.ok(/usePluginStore/.test(source));
  assert.ok(/executePluginCommand/.test(source));
});
