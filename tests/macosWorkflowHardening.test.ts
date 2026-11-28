import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getFocusedSecondaryEditor, setFocusedSecondaryEditor } from '../src/services/editorFocus.ts';

const read = (path: string) => readFileSync(path, 'utf8');

test('MCP sidecar is staged for every release target and bundled with the app', () => {
  const config = JSON.parse(read('src-tauri/tauri.conf.json'));
  const workflow = read('.github/workflows/build.yml');
  assert.deepEqual(config.bundle.externalBin, ['binaries/zeditor_mcp_server']);
  assert.match(config.build.beforeDevCommand, /npm run mcp:sidecar && npm run dev/);
  assert.match(config.build.beforeBuildCommand, /npm run mcp:sidecar && npm run build/);
  assert.match(read('package.json'), /"mcp:sidecar": "node scripts\/prepare-mcp-sidecar\.mjs"/);
  assert.match(read('.gitignore'), /src-tauri\/binaries\//);
  assert.equal((workflow.match(/npm run mcp:sidecar --/g) ?? []).length, 4);
  assert.match(workflow, /x86_64-pc-windows-msvc debug/);
  assert.match(workflow, /npm run mcp:sidecar -- \$\{\{ matrix\.target \}\}/);
});

test('sidecar staging accepts an explicit cross-compilation target', () => {
  const script = read('scripts/prepare-mcp-sidecar.mjs');
  assert.match(script, /process\.argv\[2\]/);
  assert.match(script, /process\.env\.TAURI_ENV_TARGET_TRIPLE/);
  assert.match(script, /execFileSync\('cargo'/);
  assert.doesNotMatch(script, /if \(!statSync\(source\)\.isFile\(\)\) throw new Error\('not a file'\)/);
  assert.match(script, /'target', target/);
  assert.match(script, /zeditor_mcp_server-\$\{target\}/);
  assert.match(script, /无效的 Rust target triple/);
  assert.match(script, /TAURI_CONFIG: JSON\.stringify\(\{ bundle: \{ externalBin: \[\] \} \}\)/);
  assert.match(script, /'--bin', 'zeditor_mcp_server'/);
});

test('editor focus tracking clears stale targets on non-focusable sidebar clicks', () => {
  const source = read('src/services/editorFocus.ts');
  assert.match(source, /window\.addEventListener\('pointerdown'[\s\S]*?true\)/);
  assert.match(source, /!target\.closest\('\.secondary-editor-pane'\)/);
});

test('focused secondary editor is independent from the active tab and can be cleared', () => {
  setFocusedSecondaryEditor(null);
  assert.equal(getFocusedSecondaryEditor(), null);
  const target = { tabId: 'right-tab', undo() {}, redo() {}, focus() {} };
  setFocusedSecondaryEditor(target);
  assert.equal(getFocusedSecondaryEditor(), target);
  setFocusedSecondaryEditor(null);
  assert.equal(getFocusedSecondaryEditor(), null);
});

test('native save and history target the focused secondary document', () => {
  const menu = read('src/components/MenuBar/MenuBar.tsx');
  assert.match(menu, /getFocusedSecondaryEditor\(\) \?\? useAppStore\.getState\(\)\.editorView/);
  assert.match(menu, /const getCommandTab = \(\) =>[\s\S]*?getFocusedSecondaryEditor\(\)\?\.tabId/);
  assert.match(menu, /const tab = getCommandTab\(\)/);
  assert.match(menu, /const targetTab = getCommandTab\(\)/);
  assert.match(menu, /secondary-editor-host/);
});

test('secondary Monaco publishes focus without replacing the main controller and releases its model', () => {
  const source = read('src/components/Editor/SecondaryEditor.tsx');
  assert.match(source, /onDidFocusEditorText\(\(\) => setFocusedSecondaryEditor/);
  assert.doesNotMatch(source, /onDidBlurEditorText\(\(\) => setFocusedSecondaryEditor\(null\)\)/);
  assert.match(source, /editor\.trigger\('native-menu', 'undo'/);
  assert.match(source, /editor\.trigger\('native-menu', 'redo'/);
  assert.match(source, /ownedModel\.dispose\(\)/);
  assert.doesNotMatch(source, /setEditorView/);
});

test('split document workspace preserves source-preview row layout in split mode', () => {
  const component = read('src/components/Editor/SplitEditorWorkspace.tsx');
  const css = read('src/styles/splitWorkspace.css');
  assert.match(component, /const mode = useAppStore\(state => state\.mode\)/);
  assert.match(component, /split-editor-main-\$\{mode\}/);
  assert.match(css, /\.split-editor-main-split\s*\{\s*flex-direction:\s*row;/);
});

test('MCP probe continuously drains stderr and retains bounded diagnostics', () => {
  const rust = read('src-tauri/src/mcp/clients.rs');
  assert.match(rust, /fn drain_stderr/);
  assert.match(rust, /let stderr_output = drain_stderr\(stderr\)/);
  assert.match(rust, /stderr_tail\(&stderr_output\)/);
  assert.match(rust, /while tail\.chars\(\)\.count\(\) > 8192/);
});
