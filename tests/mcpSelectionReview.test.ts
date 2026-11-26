import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('MCP selection_set 默认进入内联审阅而不是直接写正文', () => {
  const source = readFileSync('src/services/mcpDispatcher.ts', 'utf8');
  const branch = source.slice(source.indexOf("case 'selection_set'"), source.indexOf('default:', source.indexOf("case 'selection_set'")));
  assert.ok(/auto_approve/.test(branch));
  assert.ok(/proposeEdit/.test(branch));
  assert.ok(/pending_review/.test(branch));
});
