import type { IRange, languages } from 'monaco-editor/esm/vs/editor/editor.api.js';
import { suggestWikiTargets, type NoteMetadata } from './metadataIndex.ts';

export interface WikiQuery { from: number; to: number; query: string }

export function wikiCompletionQuery(line: string, caretColumn: number): WikiQuery | null {
  const before = line.slice(0, caretColumn - 1);
  const match = before.match(/\[\[([^[\]\r\n]*)$/);
  if (!match) return null;
  return { from: caretColumn - match[0].length, to: caretColumn, query: match[1] };
}

export function buildWikiCompletions(
  notes: readonly Pick<NoteMetadata, 'path' | 'title' | 'aliases'>[],
  query: string,
  currentPath: string | undefined,
  range: IRange,
): languages.CompletionItem[] {
  return suggestWikiTargets(notes as NoteMetadata[], query, currentPath).slice(0, 30).map(note => ({
    label: note.title,
    kind: 18,
    detail: note.path,
    documentation: note.aliases.length ? `别名：${note.aliases.join('、')}` : note.path,
    insertText: `[[${note.title}]]`,
    filterText: [note.title, note.path, ...note.aliases].join(' '),
    range,
  }));
}
