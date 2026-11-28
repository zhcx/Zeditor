import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

test('应用接入分栏、本地历史和知识管理入口', () => {
  const app = read('src/App.tsx');
  assert.ok(/SplitEditorWorkspace/.test(app), '缺少分栏工作区');
  assert.ok(/localHistoryRecorder|WorkspaceSync/.test(app), '缺少历史同步');
  assert.ok(/zeditor-toggle-split/.test(app), '缺少分栏事件');
  assert.ok(/zeditor-open-knowledge/.test(app), '缺少知识事件');
  assert.ok(/zeditor-plugin-insert/.test(app), '缺少插件插入事件');
});

test('活动栏与侧栏提供知识和历史视图', () => {
  const activity = read('src/components/ActivityBar/ActivityBar.tsx');
  const sidebar = read('src/components/Sidebar/Sidebar.tsx');
  assert.ok(/'knowledge'/.test(activity), '活动栏缺少知识入口');
  assert.ok(/'history'/.test(activity), '活动栏缺少历史入口');
  assert.ok(/KnowledgePanel/.test(sidebar), '侧栏缺少知识面板');
  assert.ok(/LocalHistoryPanel/.test(sidebar), '侧栏缺少历史面板');
});

test('设置页接入项目上下文与安全插件', () => {
  const settings = read('src/components/Settings/SettingsPanel.tsx');
  assert.ok(/ProjectContextPanel/.test(settings), '缺少项目上下文面板');
  assert.ok(/SafePluginsPanel/.test(settings), '缺少安全插件面板');
});
