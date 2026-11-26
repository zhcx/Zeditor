import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildProjectContext, projectContextPaths, type ProjectContextFile } from '../src/utils/projectContext.ts';

const componentPath = new URL('../src/components/Settings/ProjectContextPanel.tsx', import.meta.url);
const stylePath = new URL('../src/components/Settings/ProjectContextPanel.css', import.meta.url);
const storePath = new URL('../src/stores/projectContextStore.ts', import.meta.url);

async function loadStore() {
  assert.ok(existsSync(storePath), 'projectContextStore 应先实现');
  return import('../src/stores/projectContextStore.ts');
}

const contextFile: ProjectContextFile = {
  scope: 'project', kind: 'instructions', path: '/vault/.zeditor/agent.md', title: '项目写作要求', content: '保持中文。',
};

test('项目上下文 Store 加载服务数据并暴露预算和技能选择', async () => {
  const { createProjectContextStore } = await loadStore();
  let finishLoad!: (value: { files: ProjectContextFile[]; errors: string[] }) => void;
  const load = () => new Promise<{ files: ProjectContextFile[]; errors: string[] }>(resolve => { finishLoad = resolve; });
  const store = createProjectContextStore({ load, save: async () => {} });
  assert.equal(store.getState().files.length, 0);
  assert.equal(store.getState().loading, false);

  const pending = store.getState().load('/vault');
  assert.equal(store.getState().loading, true);
  assert.equal(store.getState().root, '/vault');
  finishLoad({ files: [contextFile], errors: [] });
  await pending;

  assert.deepEqual(store.getState().files, [contextFile]);
  assert.equal(store.getState().loading, false);
  assert.equal(store.getState().error, null);
  store.getState().setBudget(2400);
  store.getState().setSelectedSkills(['审校']);
  assert.equal(store.getState().budget, 2400);
  assert.deepEqual(store.getState().selectedSkills, ['审校']);
});

test('切换工作区时立即清空上一个项目的上下文', async () => {
  const { createProjectContextStore } = await loadStore();
  let finish!: (value: { files: ProjectContextFile[]; errors: string[] }) => void;
  const store = createProjectContextStore({ load: (root) => root === '/vault-a'
    ? Promise.resolve({ files: [contextFile], errors: [] })
    : new Promise(resolve => { finish = resolve; }), save: async () => {} });
  await store.getState().load('/vault-a');
  assert.equal(store.getState().files.length, 1);
  const pending = store.getState().load('/vault-b');
  assert.equal(store.getState().files.length, 0);
  finish({ files: [], errors: [] });
  await pending;
});

test('保存期间切换工作区不会把旧项目文件写入新项目', async () => {
  const { createProjectContextStore } = await loadStore();
  let finishSave!: () => void;
  const store = createProjectContextStore({
    load: async root => ({ files: root === '/vault-a' ? [contextFile] : [], errors: [] }),
    save: () => new Promise(resolve => { finishSave = () => resolve(undefined); }),
  });
  await store.getState().load('/vault-a');
  const saving = store.getState().save(contextFile.path, '旧项目新内容');
  await store.getState().load('/vault-b');
  await store.getState().load('/vault-a');
  finishSave();
  await assert.rejects(saving, /工作区已切换/);
  assert.equal(store.getState().files[0].content, '保持中文。');
});

test('保存成功后更新对应文件，失败时保留错误状态', async () => {
  const { createProjectContextStore } = await loadStore();
  const saves: Array<[string, string]> = [];
  let fail = false;
  const store = createProjectContextStore({
    load: async () => ({ files: [contextFile], errors: [] }),
    save: async (path: string, content: string) => {
      if (fail) throw new Error('磁盘不可写');
      saves.push([path, content]);
    },
  });
  await store.getState().load('/vault');
  await store.getState().save(contextFile.path, '更新后的要求。');
  assert.deepEqual(saves, [[contextFile.path, '更新后的要求。']]);
  assert.equal(store.getState().files[0].content, '更新后的要求。');
  assert.equal(store.getState().error, null);

  fail = true;
  await assert.rejects(store.getState().save(contextFile.path, '不能保存'), /磁盘不可写/);
  assert.equal(store.getState().error, '磁盘不可写');
  assert.equal(store.getState().loading, false);
  assert.equal(store.getState().files[0].content, '更新后的要求。');
});

test('加载失败可见且空根目录不会调用服务', async () => {
  const { createProjectContextStore } = await loadStore();
  let calls = 0;
  const store = createProjectContextStore({ load: async () => { calls += 1; throw new Error('读取失败'); }, save: async () => {} });
  await store.getState().load('');
  assert.equal(calls, 0);
  assert.equal(store.getState().files.length, 0);
  await assert.rejects(store.getState().load('/missing'), /读取失败/);
  assert.equal(store.getState().error, '读取失败');
  assert.equal(store.getState().loading, false);
});

test('新建四类上下文使用项目路径和可解析的 Markdown 模板', async () => {
  const { createProjectContextStore } = await loadStore();
  const saves: Array<{ path: string; content: string }> = [];
  const store = createProjectContextStore({ load: async () => ({ files: [], errors: [] }), save: async (path: string, content: string) => { saves.push({ path, content }); } });
  await store.getState().load('C:/vault');
  const created = [];
  for (const kind of ['instructions', 'style', 'library', 'skill'] as const) created.push(await store.getState().createDefault(kind));

  const paths = projectContextPaths('C:/vault');
  assert.equal(created[0].path, paths.instructions);
  assert.equal(created[1].path, paths.style);
  assert.ok(created[2].path.startsWith(`${paths.library}/`));
  assert.ok(created[3].path.startsWith(`${paths.skills}/`));
  assert.match(created[0].content, /写作要求/);
  assert.match(created[1].content, /文风/);
  assert.match(created[2].content, /^---\nname:/);
  assert.match(created[2].content, /aliases:/);
  assert.match(created[3].content, /^---\nname:/);
  assert.equal(store.getState().files.length, 4);
  assert.deepEqual(saves.map(item => item.path), created.map(item => item.path));
});

test('项目上下文面板接线工作区、编辑、新建和预算预览', () => {
  assert.ok(existsSync(componentPath), 'ProjectContextPanel 应先实现');
  const source = readFileSync(componentPath, 'utf8');
  assert.ok(source.split('\n').length <= 200, '组件不得超过 200 行');
  assert.match(source, /ProjectContextPanel\.css/);
  assert.match(source, /zeditor\.workspace-roots/);
  assert.match(source, /readStoredStringArray/);
  assert.match(source, /useProjectContextStore/);
  assert.match(source, /buildProjectContext\(files, requestText, budget, selectedSkills\)/);
  assert.match(source, /\.scope/);
  assert.match(source, /\.kind/);
  assert.match(source, /\.title/);
  assert.match(source, /<textarea/);
  assert.match(source, /save\(selected\.path, draft\)/);
  assert.match(source, /edit && edit\.path === selected\?\.path/);
  for (const label of ['新建文风', '新建写作要求', '新建资料条目', '新建技能']) assert.ok(source.includes(label));
  for (const label of ['刷新', '当前请求', '将注入', '因预算省略', '本地 Markdown', '设为当前请求上下文']) assert.ok(source.includes(label));
  assert.doesNotMatch(source, />设为当前请求上下文\s*</);
  assert.match(source, /AppIcon/);
});

test('项目上下文样式仅使用主题 token 并提供窄屏布局', () => {
  assert.ok(existsSync(stylePath), 'ProjectContextPanel.css 应先实现');
  const source = readFileSync(stylePath, 'utf8');
  assert.match(source, /var\(--ui-/);
  assert.match(source, /var\(--bg-/);
  assert.match(source, /var\(--text-/);
  assert.match(source, /var\(--border/);
  assert.match(source, /var\(--accent/);
  assert.match(source, /@media/);
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i);
});

test('上下文预览真实使用构建器区分注入与预算省略', () => {
  const files = [contextFile, { ...contextFile, path: '/vault/.zeditor/style.md', kind: 'style' as const, title: '文风', content: '句子简短。' }];
  const result = buildProjectContext(files, '继续写作', 20);
  assert.ok(result.used.length > 0);
  assert.ok(result.omitted.length > 0);
  assert.ok(result.omitted.every(file => !result.used.includes(file)));
});
