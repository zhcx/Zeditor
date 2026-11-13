import { create } from 'zustand';
import { snippetContextFromPath } from '../utils/snippetExpansion';

/**
 * 本地资料库：片段（snippets）、笔记模板（templates）、置顶文件（pinned）。
 * 纯前端 localStorage 持久化，不依赖 Tauri，浏览器预览与桌面端行为一致。
 */

export interface SnippetItem {
  id: string;
  name: string;
  description: string;
  template: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  content: string;
}

export interface PinnedItem {
  path: string;
  title: string;
  type: 'file' | 'folder';
  timestamp: number;
}

export type LibraryDialog = 'snippets' | 'templates' | null;

interface PersistShape {
  snippets: SnippetItem[];
  templates: TemplateItem[];
  pinned: PinnedItem[];
}

interface LibraryState extends PersistShape {
  dialog: LibraryDialog;
  setDialog: (dialog: LibraryDialog) => void;

  addSnippet: (snippet: Omit<SnippetItem, 'id'>) => SnippetItem;
  updateSnippet: (id: string, patch: Partial<Omit<SnippetItem, 'id'>>) => void;
  deleteSnippet: (id: string) => void;

  addTemplate: (template: Omit<TemplateItem, 'id'>) => TemplateItem;
  updateTemplate: (id: string, patch: Partial<Omit<TemplateItem, 'id'>>) => void;
  deleteTemplate: (id: string) => void;

  isPinned: (path: string) => boolean;
  togglePin: (item: { path: string; title: string; type: 'file' | 'folder' }) => boolean;
  unpin: (path: string) => void;
}

const STORAGE_KEY = 'zeditor.library.v1';

function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // ignore and fall back
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function seedSnippets(): SnippetItem[] {
  return [
    { id: generateId(), name: '今日日期', description: '插入当前日期（如 2026-01-01）', template: '%date% ' },
    { id: generateId(), name: '当前时间戳', description: '例如 2026-01-01 09:30', template: '%yyyy%-%MM%-%dd% %HH%:%mm% ' },
    { id: generateId(), name: '文档信息', description: '当前文件名与所在目录', template: '- 文件：%no%\n- 目录：%folder%\n' },
    { id: generateId(), name: '代码块', description: '插入空代码块并定位光标', template: '```\n%cursor%\n```\n' },
    { id: generateId(), name: '待办事项', description: '插入一条待办', template: '- [ ] %cursor%\n' },
  ];
}

function seedTemplates(): TemplateItem[] {
  return [
    {
      id: generateId(),
      name: '会议记录',
      description: '时间、参与人、议题、结论与待办',
      content: [
        '# 会议记录',
        '',
        '- 时间：%yyyy%-%MM%-%dd% %HH%:%mm%',
        '- 地点：',
        '- 参与人：',
        '',
        '## 议题',
        '',
        '1. ',
        '',
        '## 讨论要点',
        '',
        '- ',
        '',
        '## 结论',
        '',
        '- ',
        '',
        '## 待办',
        '',
        '- [ ] ',
        '',
      ].join('\n'),
    },
    {
      id: generateId(),
      name: '每日日记',
      description: '日期、今日要事、反思与明日计划',
      content: [
        '# %yyyy%-%MM%-%dd% %dddd%',
        '',
        '## 今日要事',
        '',
        '- ',
        '',
        '## 思考与记录',
        '',
        '',
        '## 明日计划',
        '',
        '- [ ] ',
        '',
      ].join('\n'),
    },
    {
      id: generateId(),
      name: '周报',
      description: '本周完成、进行中、风险与下周计划',
      content: [
        '# 周报（%yyyy%-%MM%-%dd%）',
        '',
        '## 本周完成',
        '',
        '- ',
        '',
        '## 进行中',
        '',
        '- ',
        '',
        '## 风险与阻塞',
        '',
        '- ',
        '',
        '## 下周计划',
        '',
        '- [ ] ',
        '',
      ].join('\n'),
    },
    {
      id: generateId(),
      name: '技术方案',
      description: '背景、目标、方案、风险与排期',
      content: [
        '# 方案：%cursor%',
        '',
        '## 背景',
        '',
        '',
        '## 目标与范围',
        '',
        '- ',
        '',
        '## 方案设计',
        '',
        '',
        '## 风险与权衡',
        '',
        '- ',
        '',
        '## 排期',
        '',
        '| 阶段 | 产出 | 预计时间 |',
        '| --- | --- | --- |',
        '|  |  |  |',
        '',
      ].join('\n'),
    },
  ];
}

function loadPersisted(): PersistShape {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistShape>;
      return {
        snippets: Array.isArray(parsed.snippets) ? parsed.snippets : seedSnippets(),
        templates: Array.isArray(parsed.templates) ? parsed.templates : seedTemplates(),
        pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
      };
    }
  } catch {
    // fall through to seeds
  }
  return { snippets: seedSnippets(), templates: seedTemplates(), pinned: [] };
}

function persist(state: PersistShape): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      snippets: state.snippets,
      templates: state.templates,
      pinned: state.pinned,
    }));
  } catch {
    // localStorage 不可用（隐私模式等）时静默降级为内存态。
  }
}

const initial = loadPersisted();

export const useLibraryStore = create<LibraryState>((set, get) => ({
  ...initial,
  dialog: null,

  setDialog: (dialog) => set({ dialog }),

  addSnippet: (snippet) => {
    const item: SnippetItem = { id: generateId(), ...snippet };
    set((state) => {
      const next = { ...state, snippets: [item, ...state.snippets] };
      persist(next);
      return { snippets: next.snippets };
    });
    return item;
  },
  updateSnippet: (id, patch) => {
    set((state) => {
      const snippets = state.snippets.map((item) => (item.id === id ? { ...item, ...patch } : item));
      persist({ ...state, snippets });
      return { snippets };
    });
  },
  deleteSnippet: (id) => {
    set((state) => {
      const snippets = state.snippets.filter((item) => item.id !== id);
      persist({ ...state, snippets });
      return { snippets };
    });
  },

  addTemplate: (template) => {
    const item: TemplateItem = { id: generateId(), ...template };
    set((state) => {
      const templates = [item, ...state.templates];
      persist({ ...state, templates });
      return { templates };
    });
    return item;
  },
  updateTemplate: (id, patch) => {
    set((state) => {
      const templates = state.templates.map((item) => (item.id === id ? { ...item, ...patch } : item));
      persist({ ...state, templates });
      return { templates };
    });
  },
  deleteTemplate: (id) => {
    set((state) => {
      const templates = state.templates.filter((item) => item.id !== id);
      persist({ ...state, templates });
      return { templates };
    });
  },

  isPinned: (path) => get().pinned.some((item) => item.path === path),
  togglePin: ({ path, title, type }) => {
    let pinnedNow = false;
    set((state) => {
      const exists = state.pinned.some((item) => item.path === path);
      const pinned = exists
        ? state.pinned.filter((item) => item.path !== path)
        : [...state.pinned, { path, title, type, timestamp: Date.now() }];
      pinnedNow = !exists;
      persist({ ...state, pinned });
      return { pinned };
    });
    return pinnedNow;
  },
  unpin: (path) => {
    set((state) => {
      const pinned = state.pinned.filter((item) => item.path !== path);
      persist({ ...state, pinned });
      return { pinned };
    });
  },
}));

/** 便于在无 React 环境（测试/动作函数）中读取上下文。 */
export const libraryContextForPath = snippetContextFromPath;
