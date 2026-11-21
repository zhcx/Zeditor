import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { markdownSelectionToPlainText } from '../src/utils/plainText.ts';
import { formatShortcut } from '../src/utils/platformShortcuts.ts';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('复制为纯文本会剥掉 Markdown 标记、链接地址与图片语法', () => {
  const source = [
    '## 小节标题',
    '这是 **加粗**、*斜体*、~~删除线~~ 和 `代码` 的混排。',
    '一个 [链接文字](https://example.com/very/long) 与 ![图片说明](./a.png)。',
  ].join('\n');

  const plain = markdownSelectionToPlainText(source);

  assert.equal(
    plain,
    ['小节标题', '这是 加粗、斜体、删除线 和 代码 的混排。', '一个 链接文字 与 图片说明。'].join('\n'),
  );
  assert.doesNotMatch(plain, /https:\/\/example\.com/);
  assert.doesNotMatch(plain, /[#*~`]/);
});

test('快捷键文案在 macOS 上换成系统符号，其它平台保持原样', () => {
  assert.equal(formatShortcut('Ctrl+Alt+M', 'MacIntel'), '⌥⌘M');
  assert.equal(formatShortcut('Ctrl+Shift+V', 'MacIntel'), '⇧⌘V');
  assert.equal(formatShortcut('Ctrl+Y', 'MacIntel'), '⇧⌘Z');
  assert.equal(formatShortcut('F11', 'MacIntel'), '⌃⌘F');
  // 整段说明文本里的组合键也会被替换，其余文字不动。
  assert.equal(
    formatShortcut('源码对照 / 所见即所得，也可用 Ctrl+Alt+M 切换', 'MacIntel'),
    '源码对照 / 所见即所得，也可用 ⌥⌘M 切换',
  );
  // Windows / Linux 不做改写。
  assert.equal(formatShortcut('Ctrl+Alt+M', 'Win32'), 'Ctrl+Alt+M');
});

test('右键菜单的复制/粘贴统一走共享剪贴板工具，并区分「粘贴为纯文本」', async () => {
  const menuSource = await read('../src/components/Editor/EditorContextMenu.tsx');

  assert.match(menuSource, /from '\.\.\/\.\.\/utils\/clipboard'/);
  assert.match(menuSource, /writeClipboardHtml\(/);
  assert.match(menuSource, /writeClipboardText\(/);
  assert.match(menuSource, /readClipboardText\(/);
  // 不再直接 await navigator.clipboard（WKWebView 上会静默失败）。
  assert.doesNotMatch(menuSource, /await navigator\.clipboard\.(?:write|writeText|readText)\(/);
  // 「粘贴为纯文本」必须是独立动作，而不是复用普通粘贴。
  assert.match(menuSource, /runContextMenuAction\('pastePlain'\)/);
  assert.match(menuSource, /\|\s*'pastePlain'/);
  // 读不到剪贴板时要给出可见提示，而不是静默关闭菜单。
  assert.match(menuSource, /无法读取剪贴板/);
});

test('所见即所得宿主把粘贴兜底与纯文本粘贴接到会话', async () => {
  const editorSource = await read('../src/components/Wysiwyg/WysiwygEditor.tsx');

  assert.match(editorSource, /onPasteFallback=\{\(\)\s*=>\s*session\.focus\(\)\}/);
  assert.match(editorSource, /onPastePlain=\{\(text\)\s*=>\s*session\.pastePlainText\(text\)\}/);
});

test('所见即所得会话实现 pastePlainText 并支持 caretPositionFromPoint 兜底', async () => {
  const sessionSource = await read('../src/components/Wysiwyg/wysiwygSession.ts');

  assert.match(sessionSource, /pastePlainText\(text: string\): boolean/);
  assert.match(sessionSource, /caretPositionFromPoint/);
});

test('富文本复制在 WKWebView 拒绝 ClipboardItem 时退回共享降级链', async () => {
  const richSource = await read('../src/utils/richTextCopy.ts');

  assert.match(richSource, /from '\.\/clipboard'/);
  assert.match(richSource, /writeClipboardHtml\(/);
});

test('Rust 端提供 read_clipboard_text 命令并完成注册', async () => {
  const commandsSource = await read('../src-tauri/src/commands.rs');
  const mainSource = await read('../src-tauri/src/main.rs');

  assert.match(commandsSource, /pub fn read_clipboard_text\(\)\s*->\s*Result<String, String>/);
  assert.match(commandsSource, /"pbpaste"/);
  assert.match(mainSource, /commands::read_clipboard_text,/);
});

test('设置面板与块源码编辑器的快捷键文案按平台格式化', async () => {
  const settingsSource = await read('../src/components/Settings/SettingsPanel.tsx');
  const blockSource = await read('../src/components/Wysiwyg/BlockSourceEditor.tsx');

  assert.match(settingsSource, /formatShortcut\('源码对照 \/ 所见即所得[^']*Ctrl\+Alt\+M[^']*'\)/);
  assert.doesNotMatch(settingsSource, /<small>源码对照 \/ 所见即所得[^<]*Ctrl\+Alt\+M/);
  assert.match(blockSource, /formatShortcut\('Ctrl\+Enter 保存/);
});
