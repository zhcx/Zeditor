import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import { knowledgeIndexService } from '../services/knowledgeIndex.ts';
import { buildWikiCompletions, wikiCompletionQuery } from './wikiCompletion.ts';

const installed = new WeakSet<object>();
const secondaryPaths = new Map<string, string>();

export function registerSecondaryWikiPath(tabId: string, path: string | null): void {
  if (path) secondaryPaths.set(tabId, path);
  else secondaryPaths.delete(tabId);
}

export function installWikiCompletionProvider(monaco: typeof Monaco): void {
  if (installed.has(monaco)) return;
  installed.add(monaco);
  monaco.languages.registerCompletionItemProvider('markdown', {
    triggerCharacters: ['['],
    provideCompletionItems(model, position) {
      let currentPath: string | undefined;
      if (model.uri.scheme === 'inmemory' && model.uri.path.includes('/zeditor-secondary/')) {
        const tabId = decodeURIComponent(model.uri.path.split('/').pop() || '');
        currentPath = secondaryPaths.get(tabId);
      } else if (model.uri.scheme !== 'inmemory') {
        currentPath = model.uri.fsPath || undefined;
      } else {
        return { suggestions: [] };
      }
      const query = wikiCompletionQuery(model.getLineContent(position.lineNumber), position.column);
      if (!query) return { suggestions: [] };
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: query.from, endColumn: query.to };
      return { suggestions: buildWikiCompletions(knowledgeIndexService.all(), query.query, currentPath, range) };
    },
  });
}
