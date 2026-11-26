import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Monaco 与 WYSIWYG 斜杠菜单接入安全插件贡献', () => {
  for (const path of ['src/components/Editor/Editor.tsx', 'src/components/Wysiwyg/WysiwygChrome.tsx']) {
    const source = readFileSync(path, 'utf8');
    assert.ok(/createPluginSlashCommands/.test(source), path);
    assert.ok(/filterSlashCommands\([^\n]*pluginSlashCommands/.test(source), path);
  }
});

test('Monaco 接入共享 Wiki 自动补全 provider', () => {
  assert.ok(/installWikiCompletionProvider\(monaco\)/.test(readFileSync('src/components/Editor/Editor.tsx', 'utf8')));
});
