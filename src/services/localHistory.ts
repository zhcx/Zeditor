import { invoke } from '@tauri-apps/api/core';

export interface LocalHistoryEntry {
  versionId: string;
  documentId: string;
  path: string;
  createdAt: string;
  sha256: string;
  size: number;
  encoding: string;
  label: string;
}

export interface LocalHistoryContent {
  entry: LocalHistoryEntry;
  content: string;
}

type Invoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** 路径身份不写入用户文档；重命名时由原生历史库迁移。 */
export function documentIdForPath(path: string, platform = typeof navigator === 'undefined' ? 'linux' : navigator.platform.toLowerCase()): string {
  let normalized = path.replace(/\\/g, '/').replace(/^file:\/\//i, '').replace(/\/{2,}/g, '/');
  normalized = normalized.replace(/^[a-z]:/, letter => letter.toUpperCase());
  if (platform.includes('win')) normalized = normalized.toLowerCase();
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }
  return `doc-${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

export function createLocalHistoryService(invoker: Invoker = invoke as Invoker) {
  return {
    record: (documentId: string, path: string, content: string, encoding = 'utf-8', label = '自动保存') =>
      invoker<LocalHistoryEntry>('local_history_record', { documentId, path, content, encoding, label }),
    list: (documentId: string) => invoker<LocalHistoryEntry[]>('local_history_list', { documentId }),
    read: (documentId: string, versionId: string) => invoker<LocalHistoryContent>('local_history_read', { documentId, versionId }),
    remove: (documentId: string, versionId: string) => invoker<void>('local_history_delete', { documentId, versionId }),
    migrate: (oldDocumentId: string, newDocumentId: string, newPath: string) =>
      invoker<void>('local_history_migrate', { oldDocumentId, newDocumentId, newPath }),
  };
}

export const localHistoryService = createLocalHistoryService();
