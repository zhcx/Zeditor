import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('所有 AI 编辑请求统一附带项目上下文且不持久化凭据旁路', () => {
  const source = readFileSync('src/stores/aiStore.ts', 'utf8');
  assert.ok(/withProjectContext/.test(source));
  assert.ok(/useProjectContextStore/.test(source));
  assert.doesNotMatch(source, /settings: settings\.ai/);
  assert.doesNotMatch(source, /settings: requestSettings/);
  assert.match(source, /settings: resolveProjectAIRequestSettings\(requestSettings, target\.text\)/);
  for (const action of ['rewrite', 'translate', 'summarize', 'outline', 'filename']) {
    assert.ok(source.includes(`action: '${action}'`), action);
  }
});
