import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const base = 'src/components/Knowledge';
function source(name: string): string {
  const path = `${base}/${name}.tsx`;
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, 'utf8');
}

test('面板提供六个 tab、工作区根目录、状态与窄屏滚动导航', () => {
  const panel = source('KnowledgePanel');
  const tabs = source('KnowledgeTabs');
  for (const tab of ['database', 'tasks', 'calendar', 'graph', 'properties', 'migration']) assert.match(`${panel}\n${tabs}`, new RegExp(`['"]${tab}['"]`));
  assert.match(panel, /KnowledgeTabs/);
  assert.match(panel, /root\?:\s*string/);
  assert.match(panel, /onOpenDocument\?/);
  assert.match(panel, /refresh/);
  assert.match(panel, /KnowledgeLoading/);
  assert.match(panel, /KnowledgeError/);
  assert.match(source('KnowledgeStates'), /role="status"/);
  assert.match(source('KnowledgeStates'), /role="alert"/);
  assert.match(tabs, /AppIcon/);
  assert.match(tabs, /aria-selected/);
  assert.match(tabs, /role="tablist"/);
  const css = readFileSync('src/styles/knowledge.css', 'utf8');
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /@media\s*\(max-width/);
});

test('所有知识组件复用 AppIcon 与主题 token，样式仅在 knowledge.css', () => {
  const files = ['KnowledgePanel', 'KnowledgeTabs', 'KnowledgeStates', 'DatabaseView', 'TasksView', 'CalendarView', 'GraphView', 'PropertiesView', 'MigrationView'];
  const combined = files.map(source).join('\n');
  assert.match(combined, /AppIcon/);
  const css = readFileSync('src/styles/knowledge.css', 'utf8');
  for (const family of ['ui', 'bg', 'text', 'border', 'accent']) assert.match(css, new RegExp(`--${family}`));
  for (const token of ['--ui-', '--bg-', '--text-', '--border', '--accent']) assert.match(css, new RegExp(token));
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(combined, /style=\{\{/);
});

test('每个知识 UI 组件不超过 200 行', () => {
  for (const name of ['KnowledgePanel', 'KnowledgeTabs', 'KnowledgeStates', 'DatabaseView', 'TasksView', 'CalendarView', 'GraphView', 'PropertiesView', 'MigrationView']) {
    assert.ok(source(name).trimEnd().split(/\r?\n/).length <= 200, `${name} exceeds 200 lines`);
  }
});

test('数据库支持筛选、表格、board 与 JSON Blob 导出', () => {
  const database = source('DatabaseView');
  assert.match(database, /knowledgeIndexService\.query/);
  assert.match(database, /status/);
  assert.match(database, /table/);
  assert.match(database, /board/);
  assert.match(database, /<table/);
  assert.match(database, /onOpenDocument/);
  assert.match(database, /downloadKnowledgeJson/);
});

test('任务按 done/tag 查询，勾选通过检查后保存切换状态', () => {
  const tasks = source('TasksView');
  assert.match(tasks, /knowledgeIndexService\.tasks/);
  assert.match(tasks, /done/);
  assert.match(tasks, /tag/);
  assert.match(tasks, /role="checkbox"/);
  assert.match(tasks, /aria-checked/);
  assert.match(tasks, /openDocument/);
  assert.match(tasks, /toggleMarkdownTask/);
  assert.match(tasks, /upsertCurrentContent/);
  assert.match(tasks, /task\.due/);
  assert.match(tasks, /task\.path/);
  assert.doesNotMatch(tasks, /replaceRange|saveTab|writeFile/);
});

test('日历使用 YYYY-MM 服务查询、月份切换和日期分组', () => {
  const calendar = source('CalendarView');
  assert.match(calendar, /type="month"/);
  assert.match(calendar, /knowledgeIndexService\.calendar/);
  assert.match(calendar, /shiftMonth/);
  assert.match(calendar, /groupByDate/);
  assert.match(calendar, /openDocument/);
  assert.match(calendar, /createDailyNote/);
});

test('关系图绘制 SVG 圆形布局，支持聚焦、打开、空状态与 JSON 导出', () => {
  const graph = source('GraphView');
  assert.match(graph, /<svg/);
  assert.match(graph, /knowledgeIndexService\.graph/);
  assert.match(graph, /<circle/);
  assert.match(graph, /<line/);
  assert.match(graph, /currentColor/);
  assert.match(graph, /onFocus/);
  assert.match(graph, /tabIndex=\{0\}/);
  assert.match(graph, /openDocument/);
  assert.match(graph, /downloadKnowledgeJson/);
  assert.match(graph, /KnowledgeEmpty/);
  assert.doesNotMatch(graph, /markmap|heading.*tree/i);
});

test('属性编辑校验 YAML、flush、文档身份，单次替换或回写对应 tab', () => {
  const properties = source('PropertiesView');
  assert.match(properties, /parseFrontmatter/);
  assert.match(properties, /updateFrontmatter/);
  assert.match(properties, /flushPendingEdits/);
  assert.match(properties, /isActiveEditorDocument/);
  assert.match(properties, /disabled=\{!editable\}/);
  assert.match(properties, /parsed\.errors/);
  assert.match(properties, /replaceRange\(0, snapshotSource\.length, nextContent\)/);
  assert.match(properties, /updateTabContent/);
  assert.match(properties, /onBlur=/);
  assert.match(properties, /onKeyDown=/);
  assert.equal((properties.match(/replaceRange\(/g) || []).length, 1);
  for (const field of ['title', 'status', 'tags', 'due']) assert.match(properties, new RegExp(`['"]${field}['"]`));
});

test('迁移只读分析原 vault，并可导入 Notion 新 Markdown', () => {
  const migration = source('MigrationView');
  assert.match(migration, /type="file"/);
  assert.match(migration, /webkitdirectory/);
  assert.match(migration, /@tauri-apps\/plugin-dialog/);
  assert.match(migration, /directory:\s*true/);
  assert.match(migration, /notionHtmlToMarkdown/);
  assert.match(migration, /analyzeObsidianVault/);
  assert.match(migration, /validateTyporaTheme/);
  assert.match(migration, /scanMigrationVault/);
  assert.match(migration, /importNotionHtml/);
  assert.match(migration, /readOnly/);
  assert.match(migration, /不复制|不会写入|只读/);
  assert.doesNotMatch(migration, /writeFile|copyFile|write_text|save_file|invoke\(/);
});

test('JSON 导出通过 Blob 和临时 object URL 下载', () => {
  const model = readFileSync(`${base}/knowledgeModel.ts`, 'utf8');
  assert.match(model, /new Blob/);
  assert.match(model, /createObjectURL/);
  assert.match(model, /revokeObjectURL/);
  assert.match(model, /\.click\(\)/);
});
