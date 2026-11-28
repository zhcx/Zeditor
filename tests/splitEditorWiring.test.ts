import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('第二编辑器使用独立 Monaco 实例且不发布全局 controller', () => {
  const path = 'src/components/Editor/SecondaryEditor.tsx';
  assert.equal(existsSync(path), true);
  const source = readFileSync(path, 'utf8');
  assert.match(source, /loadMonaco/);
  assert.match(source, /updateTabContent/);
  assert.match(source, /saveTab/);
  assert.match(source, /zeditor-secondary/);
  assert.match(source, /installWikiCompletionProvider/);
  assert.match(source, /registerSecondaryWikiPath/);
  assert.doesNotMatch(source, /setEditorView/);
  assert.doesNotMatch(source, /setTimeout/);
  assert.match(source, /onDidChangeContent\([\s\S]*?handleChange\(model!\.getValue\(\)\)/);
  assert.match(source, /const saveSecondary[\s\S]*?handleChange\(modelRef\.current\.getValue\(\)\)/);
});
