import { useCallback, useState } from 'react';
import { useAppStore } from '../../stores/appStore.ts';
import type { NoteMetadata } from '../../utils/metadataIndex.ts';

export interface KnowledgeViewProps {
  onOpenDocument?: (path: string) => void | Promise<void>;
}

export function useKnowledgeDocumentOpener(onOpenDocument?: KnowledgeViewProps['onOpenDocument']) {
  const openFile = useAppStore(state => state.openFile);
  const [error, setError] = useState<string | null>(null);
  const openDocument = useCallback(async (path: string) => {
    setError(null);
    try {
      if (onOpenDocument) await onOpenDocument(path);
      else await openFile(path);
    } catch (reason) {
      setError(`打开文档失败：${reason instanceof Error ? reason.message : String(reason)}`);
    }
  }, [onOpenDocument, openFile]);
  return { openDocument, error };
}

export function propertyText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(item => String(item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function noteStatus(note: NoteMetadata): string {
  return propertyText(note.properties.status) || '未设置';
}

export function noteDue(note: NoteMetadata): string {
  return propertyText(note.properties.due ?? note.properties.date);
}

export function databaseRecord(note: NoteMetadata) {
  return { path: note.path, title: note.title, status: noteStatus(note), tags: note.tags, due: noteDue(note) };
}

export function groupByDate<T>(entries: readonly T[], date: (entry: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = date(entry);
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  return groups;
}

export function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function downloadKnowledgeJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Reconstruct only index-visible Markdown features for the read-only migration report. */
export function notesToMigrationFiles(notes: readonly NoteMetadata[]) {
  return notes.map(note => ({
    path: note.path,
    content: [
      ...note.headings.map(heading => `${'#'.repeat(heading.level)} ${heading.text}`),
      ...note.links.map(link => `[[${link.target}${link.anchor ? `#${link.anchor}` : ''}]]`),
      ...note.tasks.map(task => `- [${task.done ? 'x' : ' '}] ${task.text}${task.due ? ` 📅 ${task.due}` : ''}`),
    ].join('\n'),
  }));
}
