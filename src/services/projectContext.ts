import { invoke } from '@tauri-apps/api/core';
import { parseFrontmatter } from '../utils/frontmatter.ts';
import { projectContextPaths, type ProjectContextFile, type ProjectContextKind } from '../utils/projectContext.ts';

interface FileNode { name: string; path: string; isDirectory: boolean }
interface TextDocument { content: string; encoding: string; fileVersion?: { size: number; sha256: string } | null }
interface CheckedSave { status: 'saved' | 'conflict'; fileVersion?: { size: number; sha256: string } | null }
type Invoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

function basename(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop()!.replace(/\.md$/i, '');
}

export function createProjectContextService(invoker: Invoker, configDir: string) {
  async function read(path: string, scope: 'global' | 'project', kind: ProjectContextKind): Promise<ProjectContextFile | null> {
    try {
      const document = await invoker<TextDocument>('read_text_document', { path });
      const parsed = parseFrontmatter(document.content);
      const aliases = Array.isArray(parsed.data.aliases) ? parsed.data.aliases.map(String) : typeof parsed.data.aliases === 'string' ? [parsed.data.aliases] : [];
      return {
        scope, kind, path,
        fileVersion: document.fileVersion ?? undefined,
        title: typeof parsed.data.name === 'string' ? parsed.data.name : kind === 'library' ? basename(path) : kind === 'skill' ? basename(path) : kind === 'instructions' ? (scope === 'project' ? '项目写作要求' : '全局写作要求') : '项目文风',
        content: kind === 'memory' ? parsed.body.trim() : document.content,
        aliases,
      };
    } catch { return null; }
  }

  async function readDirectory(directory: string, scope: 'global' | 'project', kind: 'library' | 'skill' | 'memory'): Promise<ProjectContextFile[]> {
    let nodes: FileNode[];
    try { nodes = await invoker<FileNode[]>('read_folder_readonly', { path: directory }); } catch { return []; }
    const files: ProjectContextFile[] = [];
    for (const node of nodes) {
      if (node.isDirectory || !/\.md$/i.test(node.name)) continue;
      const file = await read(node.path, scope, kind);
      if (file) files.push(file);
    }
    return files;
  }

  return {
    async load(projectRoot: string) {
      const project = projectContextPaths(projectRoot);
      const global = {
        instructions: `${configDir.replace(/[\\/]+$/, '')}/agent.md`,
        style: `${configDir.replace(/[\\/]+$/, '')}/style.md`,
        library: `${configDir.replace(/[\\/]+$/, '')}/library`,
        skills: `${configDir.replace(/[\\/]+$/, '')}/skills`,
      };
      await invoker('read_folder_readonly', { path: projectRoot }).catch(() => []);
      const files: ProjectContextFile[] = [];
      const add = async (path: string, scope: 'global' | 'project', kind: ProjectContextKind) => {
        const file = await read(path, scope, kind);
        if (file) files.push(file);
      };
      await add(project.instructions, 'project', 'instructions');
      await add(project.style, 'project', 'style');
      await add(global.instructions, 'global', 'instructions');
      await add(global.style, 'global', 'style');
      files.push(...await readDirectory(project.library, 'project', 'library'));
      files.push(...await readDirectory(project.skills, 'project', 'skill'));
      files.push(...await readDirectory(global.library, 'global', 'library'));
      files.push(...await readDirectory(global.skills, 'global', 'skill'));
      files.push(...await readDirectory(`${global.skills}/../memory`, 'global', 'memory'));
      return { files, errors: [] as string[] };
    },

    async save(path: string, content: string, expectedVersion?: { size: number; sha256: string }): Promise<{ size: number; sha256: string } | null> {
      if (expectedVersion) {
        const result = await invoker<CheckedSave>('save_file_content_checked', { path, content, encoding: 'utf-8', expectedVersion });
        if (result.status !== 'saved') throw new Error('项目上下文已被外部修改，未覆盖。请刷新后重新编辑。');
        return result.fileVersion ?? null;
      }
      let existing: TextDocument | null = null;
      try { existing = await invoker<TextDocument>('read_text_document', { path }); } catch { /* 新文件 */ }
      if (existing) {
        if (existing.fileVersion) return this.save(path, content, existing.fileVersion);
        throw new Error('项目上下文版本未知，请刷新后重新编辑。');
      }
      const normalizedPath = path.replace(/\\/g, '/');
      const projectRoot = normalizedPath.includes('/.zeditor/') ? normalizedPath.split('/.zeditor/')[0] : null;
      if (projectRoot) await invoker('read_folder', { path: projectRoot }).catch(() => []);
      const directory = normalizedPath.split('/').slice(0, -1).join('/');
      await invoker('create_directory', { path: directory });
      const created = await invoker<boolean>('create_file_exclusive', { path, content });
      if (!created) throw new Error('同名项目上下文已存在，未覆盖。');
      try {
        const saved = await invoker<TextDocument>('read_text_document', { path });
        return saved.fileVersion ?? null;
      } catch {
        return null;
      }
    },
  };
}

export async function loadProjectContext(projectRoot: string) {
  const { appConfigDir } = await import('@tauri-apps/api/path');
  const configDir = await appConfigDir();
  return createProjectContextService(invoke as Invoker, configDir).load(projectRoot);
}

export async function saveProjectContextFile(path: string, content: string, expectedVersion?: { size: number; sha256: string }) {
  const { appConfigDir } = await import('@tauri-apps/api/path');
  const configDir = await appConfigDir();
  return createProjectContextService(invoke as Invoker, configDir).save(path, content, expectedVersion);
}
