import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parsePluginManifest } from '../src/utils/pluginManifest.ts';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });
const { usePluginStore } = await import('../src/stores/pluginStore.ts');

const componentPath = new URL('../src/components/Settings/SafePluginsPanel.tsx', import.meta.url);
const stylePath = new URL('../src/components/Settings/SafePluginsPanel.css', import.meta.url);

const exampleManifest = {
  id: 'example.safe', name: '安全示例', version: '1.0.0', description: '仅声明式贡献',
  permissions: ['commands', 'slash', 'panel'],
  contributions: {
    commands: [
      { id: 'signature', title: '插入签名', action: { type: 'insert-text', text: '——作者' } },
      { id: 'knowledge', title: '打开知识库', action: { type: 'dispatch', event: 'zeditor-open-knowledge' } },
    ],
    slash: [{ id: 'polish', title: '润色提示', insert: '请润色这段文字。' }],
    panels: [{ id: 'guide', title: '使用说明', markdown: '# 安全说明\n<script>alert(1)</script>\n这是纯文本。' }],
  },
};

test('安全插件面板由现有 Store 提供导入、启停、删除与贡献列表', () => {
  usePluginStore.setState({ plugins: [] });
  usePluginStore.getState().import(JSON.stringify(exampleManifest));
  const state = usePluginStore.getState();
  assert.equal(state.commands().length, 2);
  assert.equal(state.slashItems().length, 1);
  assert.equal(state.panels()[0].title, '使用说明');
  state.toggle('example.safe');
  assert.equal(usePluginStore.getState().commands().length, 0);
  assert.equal(usePluginStore.getState().panels().length, 0);
  usePluginStore.getState().remove('example.safe');
  assert.equal(usePluginStore.getState().plugins.length, 0);
});

test('面板 wiring 覆盖 JSON 文件/文本、示例、错误和三类贡献', () => {
  assert.ok(existsSync(componentPath), 'SafePluginsPanel 应先实现');
  const source = readFileSync(componentPath, 'utf8');
  assert.ok(source.split('\n').length <= 200, '组件不得超过 200 行');
  assert.match(source, /SafePluginsPanel\.css/);
  assert.match(source, /usePluginStore/);
  assert.match(source, /type="file"/);
  assert.match(source, /accept="application\/json,\.json"/);
  assert.match(source, /<textarea/);
  assert.match(source, /导入 JSON 文本/);
  assert.match(source, /导入 JSON 文件/);
  assert.match(source, /填入示例 manifest/);
  assert.match(source, /role="alert"/);
  for (const label of ['插件', '启用', '删除', '命令', '斜杠命令', '面板', '纯文本预览']) assert.ok(source.includes(label));
  assert.match(source, /commands\(\)/);
  assert.match(source, /slashItems\(\)/);
  assert.match(source, /panels\(\)/);
  assert.match(source, /AppIcon/);
});

test('命令只通过指定 CustomEvent 分发且面板不注入 HTML', () => {
  assert.ok(existsSync(componentPath), 'SafePluginsPanel 应先实现');
  const source = readFileSync(componentPath, 'utf8');
  assert.match(source, /window\.dispatchEvent\(new CustomEvent\('zeditor-plugin-insert', \{ detail: \{ text: command\.action\.text \} \}\)\)/);
  assert.match(source, /window\.dispatchEvent\(new CustomEvent\(command\.action\.event\)\)/);
  assert.match(source, /<pre[^>]*>\{panel\.markdown\}<\/pre>/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML/);
  assert.doesNotMatch(source, /eval\(|new Function/);
  assert.ok(source.includes('声明式安全 MVP，不执行任意 JS/无文件系统网络权限'));
});

test('示例按钮只填充文本，导入仍由现有严格解析器校验', () => {
  assert.ok(existsSync(componentPath), 'SafePluginsPanel 应先实现');
  const source = readFileSync(componentPath, 'utf8');
  const handler = source.match(/<button[^>]*>[^<]*填入示例 manifest[^<]*<\/button>/)?.[0] ?? '';
  assert.match(handler, /setManifestText\(JSON\.stringify\(EXAMPLE_MANIFEST, null, 2\)\)/);
  assert.doesNotMatch(handler, /importManifest|\.import\(/);
  assert.match(source, /try \{\s*const manifest = importPlugin\(manifestText\);/);
  assert.match(source, /function importError\(error: unknown\): string \{\s*return error instanceof Error \? error\.message : '导入失败';/);
  assert.match(source, /catch \(error\) \{\s*setImportError\(importError\(error\)\);/);
  assert.throws(() => parsePluginManifest(JSON.stringify({ ...exampleManifest, entrypoint: 'https://example.test/plugin.js' })), /代码|远程入口/);
});

test('安全插件样式使用主题 token、状态和窄屏布局', () => {
  assert.ok(existsSync(stylePath), 'SafePluginsPanel.css 应先实现');
  const source = readFileSync(stylePath, 'utf8');
  for (const token of ['--ui-', '--bg-', '--text-', '--border', '--accent']) assert.ok(source.includes(`var(${token}`));
  assert.match(source, /is-enabled|is-disabled|aria-checked/);
  assert.match(source, /@media/);
  assert.match(source, /white-space:\s*pre-wrap/);
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i);
});
