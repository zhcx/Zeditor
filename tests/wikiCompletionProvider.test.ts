import test from 'node:test';
import assert from 'node:assert/strict';
import { installWikiCompletionProvider, registerSecondaryWikiPath } from '../src/utils/wikiCompletionProvider.ts';

function monacoMock() {
  const state: { count: number; provider: null | { provideCompletionItems: (model: unknown, position: unknown) => { suggestions: unknown[] } } } = { count: 0, provider: null };
  return {
    state,
    api: { languages: { registerCompletionItemProvider: (_language: string, value: NonNullable<typeof state.provider>) => { state.count += 1; state.provider = value; } } },
  };
}

test('Wiki provider 只注册一次并支持主编辑器与分栏路径', () => {
  const mock = monacoMock();
  installWikiCompletionProvider(mock.api as never);
  installWikiCompletionProvider(mock.api as never);
  assert.equal(mock.state.count, 1);
  registerSecondaryWikiPath('tab-1', 'C:/notes/a.md');
  const model = { uri: { scheme: 'inmemory', path: '/zeditor-secondary/tab-1', fsPath: '' }, getLineContent: () => '[[Al' };
  const result = mock.state.provider!.provideCompletionItems(model, { lineNumber: 1, column: 5 });
  assert.equal(Array.isArray(result.suggestions), true);
});
