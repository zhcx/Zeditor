import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('工作区同步组件防抖更新知识索引并自动记录本地历史', () => {
  const path = 'src/components/WorkspaceSync.tsx';
  assert.equal(existsSync(path), true);
  const source = readFileSync(path, 'utf8');
  assert.ok(/localHistoryRecorder\.observe/.test(source));
  assert.ok(/knowledgeIndexService\.upsert/.test(source));
  assert.ok(/knowledgeIndexService\.rename/.test(source));
  assert.ok(/setTimeout/.test(source));
  assert.ok(/zeditor-knowledge-updated/.test(source));
  assert.ok(/useProjectContextStore/.test(source));
  assert.ok(/resolveCurrentWorkspaceRoot/.test(source));
  assert.ok(/\.load\(workspaceRoot\)/.test(source));
  assert.ok(/saveAsFromPath/.test(source));
});
