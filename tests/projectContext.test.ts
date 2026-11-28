import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectContext, parseProjectMemory, projectContextPaths, resolveCurrentWorkspaceRoot } from '../src/utils/projectContext.ts';

const files = [
  { scope: 'project', kind: 'instructions', path: '.zeditor/agent.md', title: '项目要求', content: '<!-- 注释 -->\n保持中文。' },
  { scope: 'global', kind: 'instructions', path: 'agent.md', title: '全局要求', content: '不要编造事实。' },
  { scope: 'project', kind: 'style', path: '.zeditor/style.md', title: '文风', content: '句子简短。' },
  { scope: 'project', kind: 'library', path: '.zeditor/library/lin.md', title: '林然', aliases: ['小林'], content: '林然是编辑。' },
  { scope: 'project', kind: 'skill', path: '.zeditor/skills/review.md', title: '审校', content: '检查逻辑。' },
] as const;

test('项目上下文按优先级注入并移除注释', () => {
  const result = buildProjectContext([...files], '请改写林然的简介');
  assert.match(result.text, /保持中文/);
  assert.match(result.text, /不要编造事实/);
  assert.match(result.text, /句子简短/);
  assert.match(result.text, /林然是编辑/);
  assert.doesNotMatch(result.text, /注释/);
  assert.ok(result.used.some(file => file.title === '林然'));
});

test('未提及的资料库不注入，技能只有显式选择才注入', () => {
  const result = buildProjectContext([...files], '改写其他内容');
  assert.doesNotMatch(result.text, /林然是编辑/);
  assert.doesNotMatch(result.text, /检查逻辑/);
  const selected = buildProjectContext([...files], '审校这段', 12000, ['审校']);
  assert.match(selected.text, /检查逻辑/);
});

test('上下文预算优先保留指令和文风', () => {
  const result = buildProjectContext([...files], '林然 小林', 50);
  assert.match(result.text, /保持中文/);
  assert.ok(result.text.length <= 160);
  assert.ok(result.omitted.length > 0);
});

test('项目上下文会脱敏常见密钥和 Bearer 令牌', () => {
  const result = buildProjectContext([{ scope: 'project', kind: 'instructions', path: '.zeditor/agent.md', title: '要求', content: 'API key sk-1234567890abcdef\nAuthorization: Bearer abc.def.ghi\nAIza12345678901234567890123456789012345\ngithub_pat_1234567890abcdefghijklmnopqrstuvwxyz\nhttps://user:password@example.com' }], '写作');
  assert.doesNotMatch(result.text, /sk-1234567890abcdef/);
  assert.doesNotMatch(result.text, /abc\.def\.ghi/);
  assert.doesNotMatch(result.text, /AIza1234567890/);
  assert.doesNotMatch(result.text, /github_pat_1234567890/);
  assert.doesNotMatch(result.text, /user:password/);
  assert.match(result.text, /\[已脱敏\]/);
});

test('上下文标题也会脱敏', () => {
  const token = 'AIza12345678901234567890123456789012345';
  const result = buildProjectContext([{ scope: 'project', kind: 'library', path: '.zeditor/library/a.md', title: token, content: '事实' }], token);
  assert.doesNotMatch(result.text, new RegExp(token));
});

test('当前工作区根据文档路径选择最长匹配根目录', () => {
  const values = new Map([['zeditor.workspace-roots', JSON.stringify(['C:/vault', 'C:/vault/sub'])]]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null } });
  assert.equal(resolveCurrentWorkspaceRoot('C:/vault/sub/note.md'), 'C:/vault/sub');
  assert.equal(resolveCurrentWorkspaceRoot('C:/other/note.md'), '');
  assert.equal(resolveCurrentWorkspaceRoot(null), '');
});

test('项目文件路径和记忆 frontmatter 可解析', () => {
  const paths = projectContextPaths('C:/vault');
  assert.equal(paths.instructions, 'C:/vault/.zeditor/agent.md');
  assert.equal(paths.library, 'C:/vault/.zeditor/library');
  const memory = parseProjectMemory('---\nkind: requirement\ncreated: 2026-01-01\n---\n始终使用中文。');
  assert.equal(memory.kind, 'requirement');
  assert.equal(memory.content, '始终使用中文。');
});
