import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

test('知识库搜索独占内容区，不叠加隐藏的 tabpanel', () => {
  const panel = read('src/components/Knowledge/KnowledgePanel.tsx');
  assert.match(panel, /!searchOpen && <><KnowledgeSummary \/><KnowledgeTabs \/><\/>/);
  assert.match(panel, /searchOpen\s*\? <KnowledgeSearch/);
  assert.match(panel, /<main className="knowledge-view"/);
  assert.match(panel, /aria-pressed=\{searchOpen\}/);
  assert.match(panel, /aria-pressed=\{quickNoteOpen\}/);
});

test('窄知识库导航使用完整三列两行且不产生横向滚动', () => {
  const css = read('src/styles/knowledge.css');
  assert.match(css, /\.knowledge-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.knowledge-tabs button\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /@container \(min-width: 460px\)/);
  assert.doesNotMatch(css, /\.knowledge-tabs\s*\{[^}]*overflow-x:\s*auto/s);
});

test('设置分类在图标模式和无障碍树中都有可读名称', () => {
  const settings = read('src/components/Settings/SettingsPanel.tsx');
  assert.match(settings, /role="dialog"/);
  assert.match(settings, /aria-modal="true"/);
  assert.match(settings, /aria-labelledby="settings-title"/);
  assert.match(settings, /id="settings-title"/);
  assert.match(settings, /aria-label=\{tab\.label\}/);
  assert.match(settings, /aria-current=\{activeTab === tab\.id \? 'page' : undefined\}/);
});

test('设置导航可独立滚动，短窗口不会裁掉分类', () => {
  const css = read('src/styles/comfort.css');
  assert.match(css, /\.settings-navigation \.settings-tabs\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.settings-navigation \.settings-tabs\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.settings-navigation \.settings-tabs\s*\{[^}]*overscroll-behavior:\s*contain/s);
});

test('状态栏 AI 菜单随主题变化而非固定暗色', () => {
  const css = read('src/styles/workbench.css');
  const menu = css.match(/\.status-ai-menu \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(menu, /var\(--ui-bg-overlay\)/);
  assert.match(menu, /var\(--ui-border-strong\)/);
  assert.doesNotMatch(menu, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test('状态栏显示实时光标行列且订阅可安全释放', () => {
  const status = read('src/components/StatusBar/StatusBar.tsx');
  assert.match(status, /onSelectionChange\?\.\(updateCursor\)/);
  assert.match(status, /status-cursor/);
  assert.match(status, /cursor\.line.*cursor\.column/);
  assert.match(read('src/types/editor.ts'), /onSelectionChange\?/);
});

test('非活动标签关闭按钮不进入 Tab 顺序，沉浸 Esc 不抢占弹窗', () => {
  const tabs = read('src/components/TabsBar/TabsBar.tsx');
  assert.match(tabs, /tabIndex=\{tab\.id === activeTabId \? 0 : -1\}/);
  const app = read('src/App.tsx');
  assert.match(app, /event\.defaultPrevented/);
  assert.match(app, /querySelector\('\[role="dialog"\]/);
});

test('AI 输入框高度支持键盘调整', () => {
  const chat = read('src/components/Chatbot/AIChatbotPanel.tsx');
  assert.match(chat, /aria-valuemin=\{72\}/);
  assert.match(chat, /aria-valuemax=\{280\}/);
  assert.match(chat, /\['ArrowUp', 'ArrowDown', 'Home', 'End'\]/);
  assert.match(chat, /aria-label="上传附件"/);
  assert.match(chat, /aria-label=\{linkedDocument \? '取消关联文档' : '关联当前文档'\}/);
});

test('关键模态框共用焦点圈定、Esc 与焦点恢复', () => {
  const hook = read('src/hooks/useModalFocus.ts');
  assert.match(hook, /event\.key === 'Escape'/);
  assert.match(hook, /event\.key !== 'Tab'/);
  assert.match(hook, /previous\?\.isConnected/);
  for (const path of [
    'src/components/Settings/SettingsPanel.tsx',
    'src/components/Sidebar/LocalHistoryPanel.tsx',
    'src/components/Recovery/RecoveryDialog.tsx',
    'src/components/FileConflict/FileConflictDialog.tsx',
  ]) assert.match(read(path), /useModalFocus/);
});

test('功能菜单在视口内滚动且子菜单不被裁剪', () => {
  const menu = read('src/components/MenuBar/MenuBar.tsx');
  const css = read('src/styles/main.css');
  assert.match(menu, /className="menu-scroll"/);
  assert.match(menu, /dropdown\.style\.left/);
  assert.match(menu, /dropdown\.style\.top/);
  assert.match(css, /\.menu-scroll\s*\{[^}]*max-height:/s);
  assert.match(css, /\.menu-scroll\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.submenu-dropdown\s*\{[^}]*position:\s*fixed/s);
});

test('功能菜单按任务归并且导出入口不重复', () => {
  const menu = read('src/components/MenuBar/MenuBar.tsx');
  for (const label of ['编辑', '插入', '文档与 AI', '表格操作', '视图', '知识库', '主题', '语言']) {
    assert.ok(menu.includes(`label: t('${label}', language)`), `${label} 分组入口缺失`);
  }
  assert.equal((menu.match(/label: t\('导出为 HTML'/g) || []).length, 1);
  assert.match(menu, /find\(\(item\) => item\.label === t\('导出', language\)\)/);
  for (const shortcut of ['Ctrl+J', 'Ctrl+Shift+K', 'Ctrl+Alt+M', 'F11']) assert.match(menu, new RegExp(shortcut.replace(/\+/g, '\\+')));
});
