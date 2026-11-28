import type { NoteMetadata } from './metadataIndex.ts';

function searchable(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(searchable).join(' ');
  if (typeof value === 'object') return Object.values(value).map(searchable).join(' ');
  return String(value);
}

export function filterKnowledgeNotes(notes: readonly NoteMetadata[], query: string): NoteMetadata[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  return notes.filter(note => [
    note.title,
    note.path,
    noteBasename(note.path),
    ...note.aliases,
    ...note.tags,
    searchable(note.properties),
    note.searchText,
  ].join(' ').toLocaleLowerCase().includes(needle))
    .sort((a, b) => {
      const aExact = a.title.toLocaleLowerCase() === needle ? 0 : 1;
      const bExact = b.title.toLocaleLowerCase() === needle ? 0 : 1;
      return aExact - bExact || a.title.localeCompare(b.title);
    });
}

function noteBasename(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') || path;
}
