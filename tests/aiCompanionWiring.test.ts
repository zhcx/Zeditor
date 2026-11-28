import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('WYSIWYG editor drives automatic AI companion from block input', async () => {
  const editor = await read('../src/components/Wysiwyg/WysiwygEditor.tsx');

  // 与源码编辑器共用同一组阈值
  assert.match(editor, /COMPANION_CONTEXT_LIMIT, COMPANION_MIN_CONTEXT_CHARS/);
  assert.match(editor, /const AUTO_COMPANION_MIN_INTERVAL = 1200;/);
  // 引擎任一开启 + 自动伴写 + 折叠光标
  assert.match(editor, /currentSettings\.ai\.enabled \|\| currentSettings\.agent\.enabled/);
  assert.match(editor, /currentSettings\.ai\.auto_suggest/);
  assert.match(editor, /const selection = session\.getSelectionOffsets\(\);/);
  assert.match(editor, /if \(selection\.from !== selection\.to\)/);
  // 块内输入后调度伴写；WebKit 读不回选区时用块尾兜底，并通过块坐标定位弹窗
  assert.match(editor, /session\.handleInput\(index\);\s*\n\s*scheduleCompanion\(index\);/);
  assert.match(editor, /const block = session\.getBlocks\(\)\[blockIndex\];/);
  assert.match(editor, /blockElementsRef\.current\.get\(blockIndex\)\?\.getBoundingClientRect\(\)/);
  assert.match(editor, /requestCompanion\(\{ prompt, anchor: caret, position \}\)/);
});

test('WYSIWYG editor also listens to native input/beforeinput events for WKWebView', async () => {
  const editor = await read('../src/components/Wysiwyg/WysiwygEditor.tsx');

  // WebKit 会把嵌套 contenteditable 的事件重定向到外层宿主，必须沿 composedPath 找回真实块
  assert.match(editor, /const blockIndexFromEvent = useCallback\(\(event: Event\): number \| null => \{/);
  assert.match(editor, /event\.composedPath\(\)/);
  assert.match(editor, /addEventListener\('input', onNativeInput, true\)/);
  assert.match(editor, /addEventListener\('compositionend', onNativeInput, true\)/);
  assert.match(editor, /const handleSurfaceBeforeInput = useCallback[\s\S]*?if \(index !== null\) session\.beginInput\(index\);[\s\S]*?if \(index !== null\) scheduleCompanion\(index\);/);
});

test('Agent mode migrates automatic companion on unless the user explicitly turned it off', async () => {
  const store = await read('../src/stores/appStore.ts');

  assert.match(store, /saved\.agent\?\.enabled === true && saved\.ai\?\.auto_suggest === false && !saved\.ai\?\.auto_suggest_user_set/);
  assert.match(store, /auto_suggest_user_set\?: boolean;/);
});

test('companion insertion in source view keeps a collapsed caret instead of selecting the whole continuation', async () => {
  const aiStore = await read('../src/stores/aiStore.ts');

  assert.match(aiStore, /proposal\.kind === 'continuation'/);
  assert.match(aiStore, /const selection = proposal\.kind === 'continuation'\s*\n\s*\? \{ anchor: end, head: end \}/);
});

test('WYSIWYG controller reports viewport-bottom coordinates so popups land below the caret', async () => {
  const controller = await read('../src/components/Wysiwyg/WysiwygController.ts');

  assert.match(controller, /x: rect\.left, y: rect\.bottom/);
});

test('companion dismisses on outside pointer and Escape, and stale responses cannot reopen it', async () => {
  const [popup, store] = await Promise.all([
    read('../src/components/AI/AICompanionPopup.tsx'),
    read('../src/stores/aiStore.ts'),
  ]);

  assert.match(popup, /document\.addEventListener\('pointerdown', handlePointerDown, true\)/);
  assert.match(popup, /document\.addEventListener\('keydown', handleKeyDown, true\)/);
  assert.match(popup, /event\.key === 'Escape'/);
  assert.match(popup, /!popupRef\.current\?\.contains\(event\.target as Node\)\) dismissCompanion\(\)/);
  assert.match(store, /dismissCompanion: \(\) => \{\s*\n[\s\S]*?companionRequestSeq \+= 1;/);
  assert.match(store, /if \(cachedSuggestions\) \{\s*\n\s*if \(requestSeq !== companionRequestSeq\) return;/);
});

test('source companion only auto-triggers after content input, not bare cursor movement', async () => {
  const editor = await read('../src/components/Editor/Editor.tsx');

  assert.equal(editor.match(/scheduleCompanion\(\);/g)?.length, 1);
  assert.match(editor, /onDidChangeModelContent\(\(event\) => \{[\s\S]*?updateTabContent\(currentTabId, next, 'editor'\);\s*\n\s*scheduleCompanion\(\);/);
  assert.match(editor, /requestCompanion\(\)/);
});

test('companion insertion keeps the generation-time document anchor and offers manual generation', async () => {
  const [store, statusBar] = await Promise.all([
    read('../src/stores/aiStore.ts'),
    read('../src/components/StatusBar/StatusBar.tsx'),
  ]);

  assert.match(store, /companionTabId === activeTabId && companionAnchor !== null/);
  assert.match(store, /\? companionAnchor/);
  assert.match(statusBar, /立即在当前光标生成/);
  assert.match(statusBar, /useAIStore\.getState\(\)\.requestCompanion\(\)/);
});
