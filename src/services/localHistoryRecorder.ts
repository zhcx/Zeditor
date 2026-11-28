import { documentIdForPath, localHistoryService, type LocalHistoryEntry } from './localHistory.ts';

interface ObservedTab {
  id: string;
  path: string | null;
  saveAsFromPath?: string;
  content: string;
  modified: boolean;
  encoding?: string;
  fileVersion?: { sha256: string; size?: number } | null;
}
type RecordHistory = (documentId: string, path: string, content: string, encoding: string, label: string) => Promise<LocalHistoryEntry>;
type MigrateHistory = (oldDocumentId: string, newDocumentId: string, newPath: string) => Promise<void>;

export class LocalHistoryRecorder {
  private seen = new Map<string, { path: string; signature: string }>();
  private queue: Promise<void> = Promise.resolve();

  private record: RecordHistory;
  private migrate: MigrateHistory;

  constructor(
    record: RecordHistory = (...args) => localHistoryService.record(...args),
    migrate: MigrateHistory = (...args) => localHistoryService.migrate(...args),
  ) {
    this.record = record;
    this.migrate = migrate;
  }

  observe(tabs: readonly ObservedTab[]): Promise<void> {
    this.queue = this.queue.then(async () => {
      const open = new Set(tabs.map(tab => tab.id));
      for (const id of this.seen.keys()) if (!open.has(id)) this.seen.delete(id);
      for (const tab of tabs) {
        if (!tab.path || tab.modified) continue;
        const documentId = documentIdForPath(tab.path);
        const signature = `${tab.fileVersion?.sha256 ?? tab.content.length}:${tab.content.length}`;
        const previous = this.seen.get(tab.id);
        if (previous?.path && previous.path !== tab.path && tab.saveAsFromPath !== previous.path) {
          await this.migrate(documentIdForPath(previous.path), documentId, tab.path).catch(() => undefined);
        }
        if (!previous || previous.path !== tab.path || previous.signature !== signature) {
          await this.record(documentId, tab.path, tab.content, tab.encoding || 'utf-8', '自动保存').catch(() => undefined);
        }
        this.seen.set(tab.id, { path: tab.path, signature });
      }
    });
    return this.queue;
  }
}

export const localHistoryRecorder = new LocalHistoryRecorder();
