import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePluginManifest, pluginCommands, pluginSlashItems } from '../src/utils/pluginManifest.ts';

const manifest = {
  id: 'demo.review', name: '审阅助手', version: '1.0.0', description: '声明式插件',
  permissions: ['commands', 'slash', 'panel'],
  contributions: {
    commands: [{ id: 'insert-signature', title: '插入签名', action: { type: 'insert-text', text: '——作者' } }],
    slash: [{ id: 'signature', title: '签名', insert: '——作者' }],
    panels: [{ id: 'guide', title: '指南', markdown: '# 指南\n安全插件不会执行任意脚本。' }],
  },
};

test('声明式插件 manifest 可解析并生成命令', () => {
  const parsed = parsePluginManifest(JSON.stringify(manifest));
  assert.equal(parsed.id, 'demo.review');
  assert.equal(pluginCommands(parsed)[0].title, '插入签名');
  assert.equal(pluginSlashItems(parsed)[0].insert, '——作者');
});

test('插件不得声明任意代码、未知权限或未知动作', () => {
  assert.throws(() => parsePluginManifest(JSON.stringify({ ...manifest, code: 'alert(1)' })), /code|代码/i);
  assert.throws(() => parsePluginManifest(JSON.stringify({ ...manifest, permissions: ['filesystem'] })), /权限/);
  assert.throws(() => parsePluginManifest(JSON.stringify({ ...manifest, contributions: { commands: [{ id: 'x', title: 'x', action: { type: 'execute', code: 'x' } }] } })), /动作/);
});

test('插件 ID 与贡献 ID 必须唯一且格式安全', () => {
  assert.throws(() => parsePluginManifest(JSON.stringify({ ...manifest, id: '../bad' })), /id|ID/i);
  const duplicate = { ...manifest, contributions: { commands: [manifest.contributions.commands[0], manifest.contributions.commands[0]] } };
  assert.throws(() => parsePluginManifest(JSON.stringify(duplicate)), /重复/);
});
