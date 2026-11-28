import test from 'node:test';
import assert from 'node:assert/strict';
import { withProjectContext } from '../src/utils/aiRequestContext.ts';

const files = [{ scope: 'project', kind: 'instructions', path: '.zeditor/agent.md', title: '项目要求', content: '保持中文' }] as const;

test('AI 请求附带项目上下文且不修改原始设置', () => {
  const settings = { provider: 'custom', api_key: 'key', project_context: '旧内容' };
  const result = withProjectContext(settings, [...files], '写作', 1000, []);
  assert.equal(result.project_context, '【项目要求】\n保持中文');
  assert.equal(settings.project_context, '旧内容');
});

test('没有项目上下文时移除旧上下文字段', () => {
  const result = withProjectContext({ provider: 'custom' }, [], '写作');
  assert.equal(result.project_context, undefined);
});

test('项目 A 的上下文不会注入到项目 B 的 AI 请求', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify(['C:/vault-a', 'C:/vault-b']) } });
  const wrong = withProjectContext({ provider: 'custom' }, [...files], '写作', 1000, [], 'C:/vault-a', 'C:/vault-b/note.md');
  assert.equal(wrong.project_context, undefined);
  const right = withProjectContext({ provider: 'custom' }, [...files], '写作', 1000, [], 'C:/vault-b', 'C:/vault-b/note.md');
  assert.match(right.project_context!, /保持中文/);
});
