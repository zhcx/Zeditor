import { create } from 'zustand';
import { knowledgeIndexService, type KnowledgeIndexService } from '../services/knowledgeIndex.ts';
import type { NoteMetadata, NoteQuery, NoteTask } from '../utils/metadataIndex.ts';

export type KnowledgeTab = 'database' | 'tasks' | 'calendar' | 'graph' | 'properties' | 'migration';
export const KNOWLEDGE_ROOTS_KEY = 'zeditor.workspace-roots';

type KnowledgeIndex = Pick<KnowledgeIndexService,
  'all' | 'get' | 'query' | 'tasks' | 'calendar' | 'graph' | 'upsert' | 'scan'> & { cancel?: () => void };

export interface KnowledgeState {
  roots: string[];
  activeRoot: string;
  activeTab: KnowledgeTab;
  scanning: boolean;
  error: string | null;
  revision: number;
  setRoot: (root: string) => Promise<void>;
  scan: (root?: string) => Promise<void>;
  setActiveTab: (tab: KnowledgeTab) => void;
  clearError: () => void;
  upsertCurrentContent: (path: string, content: string) => void;
}

function readRoots(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KNOWLEDGE_ROOTS_KEY) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((root): root is string => typeof root === 'string' && Boolean(root.trim())))] : [];
  } catch {
    return [];
  }
}

function writeRoots(roots: string[]): void {
  try { localStorage.setItem(KNOWLEDGE_ROOTS_KEY, JSON.stringify(roots)); } catch { /* Restricted storage is non-fatal. */ }
}

/** The store intentionally owns no document copies; selectors query the shared index on demand. */
export function createKnowledgeStore(index: KnowledgeIndex = knowledgeIndexService) {
  let scanGeneration = 0;
  const roots = readRoots();
  return create<KnowledgeState>((set, get) => ({
    roots,
    activeRoot: roots[0] || '',
    activeTab: 'database',
    scanning: false,
    error: null,
    revision: 0,
    setRoot: async root => {
      const normalized = root.trim();
      if (!normalized) return;
      const roots = [...new Set([...get().roots, normalized])];
      writeRoots(roots);
      set({ roots, activeRoot: normalized, error: null });
      await get().scan(normalized);
    },
    scan: async requestedRoot => {
      const root = (requestedRoot ?? get().activeRoot).trim();
      if (!root) { set({ scanning: false, error: '请先选择知识库根目录' }); return; }
      const generation = ++scanGeneration;
      index.cancel?.();
      set({ scanning: true, error: null });
      try {
        const result = await index.scan(root);
        if (generation !== scanGeneration) return;
        if (result.cancelled) {
          set({ scanning: false, error: null });
          return;
        }
        const error = result.truncated
          ? `知识库扫描达到 3000 篇上限，本次为部分索引。${result.errors.length ? `另有 ${result.errors.length} 个读取错误。` : ''}`
          : result.errors.length
            ? `已扫描 ${result.scanned} 篇，${result.errors.length} 个错误：${result.errors.join('；')}`
            : null;
        set(state => ({ scanning: false, error, revision: state.revision + 1 }));
      } catch (reason) {
        if (generation !== scanGeneration) return;
        set({ scanning: false, error: `扫描失败：${reason instanceof Error ? reason.message : String(reason)}` });
      }
    },
    setActiveTab: activeTab => set({ activeTab }),
    clearError: () => set({ error: null }),
    upsertCurrentContent: (path, content) => {
      if (!path) return;
      index.upsert(path, content);
      set(state => ({ revision: state.revision + 1 }));
    },
  }));
}

export const useKnowledgeStore = createKnowledgeStore();

export function createKnowledgeSelectors(index: KnowledgeIndex = knowledgeIndexService) {
  return {
    selectDatabase: (state: KnowledgeState, filter: NoteQuery = {}) => { void state; return index.query(filter); },
    selectTasks: (state: KnowledgeState, filter: { done?: boolean; tag?: string } = {}) => { void state; return index.tasks(filter); },
    selectCalendar: (state: KnowledgeState, month: string) => { void state; return index.calendar(month); },
    selectGraph: (state: KnowledgeState) => { void state; return index.graph(); },
    selectNote: (state: KnowledgeState, path: string): NoteMetadata | undefined => { void state; return index.get(path); },
  };
}

export const knowledgeSelectors = createKnowledgeSelectors();
export type { NoteMetadata, NoteTask };
