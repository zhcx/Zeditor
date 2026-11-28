import { create } from 'zustand';
import { loadProjectContext, saveProjectContextFile } from '../services/projectContext.ts';
import { projectContextPaths, type ProjectContextFile, type ProjectContextKind } from '../utils/projectContext.ts';

export type NewProjectContextKind = 'instructions' | 'style' | 'library' | 'skill';

interface ProjectContextState {
  files: ProjectContextFile[];
  loading: boolean;
  error: string | null;
  root: string;
  budget: number;
  selectedSkills: string[];
  load: (root: string) => Promise<void>;
  save: (path: string, content: string, expectedVersion?: { size: number; sha256: string }) => Promise<{ size: number; sha256: string } | null | void>;
  createDefault: (kind: NewProjectContextKind) => Promise<ProjectContextFile>;
  setBudget: (budget: number) => void;
  setSelectedSkills: (skills: string[]) => void;
}

interface ProjectContextDependencies {
  load: (root: string) => Promise<{ files: ProjectContextFile[]; errors: string[] }>;
  save: (path: string, content: string, expectedVersion?: { size: number; sha256: string }) => Promise<{ size: number; sha256: string } | null | void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function contextTemplate(kind: NewProjectContextKind, title: string): string {
  const body = {
    instructions: '描述项目背景、事实边界和写作要求。AI 请求会优先遵循这些要求。',
    style: '描述语气、句式、用词和格式偏好。例如：简洁、克制、使用中文。',
    library: '记录人物、地点或设定事实。请求中提到名称或别名时，相关条目才会注入。',
    skill: '描述可复用的工作流程。只有显式选择该技能后，才会注入当前请求。',
  }[kind];
  return `---\nname: ${title}\naliases: []\n---\n\n# ${title}\n\n${body}\n`;
}

function fileKind(path: string): ProjectContextKind {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.includes('/.zeditor/skills/')) return 'skill';
  if (normalized.includes('/.zeditor/library/')) return 'library';
  if (normalized.endsWith('/.zeditor/style.md')) return 'style';
  return 'instructions';
}

function fileTitle(path: string, kind: ProjectContextKind): string {
  const name = path.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') || '未命名';
  return kind === 'instructions' ? '项目写作要求' : kind === 'style' ? '项目文风' : name;
}

export function createProjectContextStore(dependencies: ProjectContextDependencies) {
  let loadSequence = 0;
  let createdSequence = 0;
  return create<ProjectContextState>((set, get) => ({
    files: [], loading: false, error: null, root: '', budget: 12_000, selectedSkills: [],
    load: async root => {
      const sequence = ++loadSequence;
      const nextRoot = root.trim();
      set({ root: nextRoot, loading: true, error: null, files: [], selectedSkills: [] });
      if (!nextRoot) {
        set({ files: [], loading: false });
        return;
      }
      try {
        const result = await dependencies.load(nextRoot);
        if (sequence !== loadSequence) return;
        set({ files: result.files, error: result.errors.length ? result.errors.join('；') : null, loading: false });
      } catch (error) {
        if (sequence !== loadSequence) return;
        set({ error: errorMessage(error), loading: false });
        throw error;
      }
    },
    save: async (path, content, expectedVersion) => {
      const root = get().root.trim();
      const sequence = loadSequence;
      set({ loading: true, error: null });
      try {
        const existing = get().files.find(file => file.path === path);
        const savedVersion = await dependencies.save(path, content, expectedVersion ?? existing?.fileVersion);
        if (get().root.trim() !== root || sequence !== loadSequence) throw new Error('工作区已切换，未把旧项目上下文写入新项目。');
        const kind = existing?.kind ?? fileKind(path);
        const nextVersion = savedVersion && typeof savedVersion === 'object' ? savedVersion : undefined;
        const saved: ProjectContextFile = existing
          ? { ...existing, content, fileVersion: nextVersion ?? existing.fileVersion }
          : { scope: 'project', kind, path, title: fileTitle(path, kind), content, fileVersion: nextVersion };
        set(state => ({ files: state.files.some(file => file.path === path) ? state.files.map(file => file.path === path ? saved : file) : [...state.files, saved], loading: false }));
      } catch (error) {
        set({ error: errorMessage(error), loading: false });
        throw error;
      }
    },
    createDefault: async kind => {
      const root = get().root.trim();
      if (!root) throw new Error('请先选择工作区根目录');
      const paths = projectContextPaths(root);
      const sequence = ++createdSequence;
      const path = kind === 'instructions' ? paths.instructions : kind === 'style' ? paths.style : `${kind === 'library' ? paths.library : paths.skills}/${kind}-${Date.now()}-${sequence}.md`;
      if (get().files.some(file => file.path === path)) throw new Error('该上下文文件已存在，请直接编辑');
      const title = kind === 'instructions' ? '项目写作要求' : kind === 'style' ? '项目文风' : `${kind === 'library' ? '资料' : '技能'} ${sequence}`;
      const content = contextTemplate(kind, title);
      await get().save(path, content);
      const file = get().files.find(item => item.path === path);
      if (!file) throw new Error('上下文文件已保存，但未能读取其版本。请刷新后重试。');
      set(state => ({ files: state.files.map(item => item.path === path ? { ...item, title, aliases: [] } : item) }));
      return get().files.find(item => item.path === path)!;
    },
    setBudget: budget => set({ budget: Number.isFinite(budget) ? Math.max(1, Math.floor(budget)) : 12_000 }),
    setSelectedSkills: skills => set({ selectedSkills: [...new Set(skills.filter(skill => skill.trim()))] }),
  }));
}

export const useProjectContextStore = createProjectContextStore({ load: loadProjectContext, save: saveProjectContextFile });
