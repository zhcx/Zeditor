import test from 'node:test';
import assert from 'node:assert/strict';
import { executePluginCommand } from '../src/utils/pluginActions.ts';

test('插件插入命令通过当前编辑器选区执行', () => {
  const calls: unknown[][] = [];
  const editor = { getSelection: () => ({ from: 2, to: 4 }), replaceRange: (...args: unknown[]) => calls.push(args), focus: () => {} };
  executePluginCommand({ id: 'sign', title: '签名', pluginId: 'demo', pluginName: 'Demo', action: { type: 'insert-text', text: '签名' } }, editor as never);
  assert.deepEqual(calls, [[2, 4, '签名']]);
});

test('插件 dispatch 命令只能触发白名单 CustomEvent', () => {
  const events: string[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: (event: CustomEvent) => { events.push(event.type); return true; } } });
  executePluginCommand({ id: 'knowledge', title: '知识', pluginId: 'demo', pluginName: 'Demo', action: { type: 'dispatch', event: 'zeditor-open-knowledge' } }, null);
  assert.deepEqual(events, ['zeditor-open-knowledge']);
});
