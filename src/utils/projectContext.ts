import { parseFrontmatter } from './frontmatter.ts';

export type ProjectContextKind = 'instructions' | 'style' | 'library' | 'skill' | 'memory';
export interface ProjectContextFile {
  scope: 'global' | 'project';
  fileVersion?: { size: number; sha256: string };
  kind: ProjectContextKind;
  path: string;
  title: string;
  content: string;
  aliases?: string[];
}

export interface ProjectContextResult {
  text: string;
  used: ProjectContextFile[];
  omitted: ProjectContextFile[];
}

export function normalizeWorkspaceRoot(path: string): string {
  let normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  normalized = normalized.replace(/^[a-z]:/, letter => letter.toUpperCase());
  return /^[A-Z]:\//i.test(normalized) || normalized.startsWith('//') ? normalized.toLowerCase() : normalized;
}

export function resolveCurrentWorkspaceRoot(currentFile?: string | null): string {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('zeditor.workspace-roots') || '[]');
    const roots = Array.isArray(stored) ? stored.filter((root): root is string => typeof root === 'string' && Boolean(root.trim())) : [];
    if (!roots.length) return '';
    if (!currentFile) return '';
    const file = normalizeWorkspaceRoot(currentFile);
    const matches = roots.filter(root => {
      const normalized = normalizeWorkspaceRoot(root);
      return file === normalized || file.startsWith(`${normalized}/`);
    }).sort((a, b) => normalizeWorkspaceRoot(b).length - normalizeWorkspaceRoot(a).length);
    return matches[0] || '';
  } catch {
    return '';
  }
}

export function projectContextPaths(root: string) {
  const base = root.replace(/[\\/]+$/, '');
  return {
    instructions: `${base}/.zeditor/agent.md`,
    style: `${base}/.zeditor/style.md`,
    library: `${base}/.zeditor/library`,
    skills: `${base}/.zeditor/skills`,
  };
}

export function parseProjectMemory(source: string) {
  const parsed = parseFrontmatter(source);
  return {
    kind: typeof parsed.data.kind === 'string' ? parsed.data.kind : 'preference',
    content: parsed.body.trim(),
    errors: parsed.errors,
  };
}

function clean(content: string): string {
  return content
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, '[已脱敏]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [已脱敏]')
    .replace(/https?:\/\/[^/\s:@]+:[^/\s@]+@/gi, 'https://[已脱敏]@')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[已脱敏]')
    .replace(/\b(?:github_pat_|ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{20,}\b/g, '[已脱敏]')
    .replace(/\bAIza[A-Za-z0-9_-]{35}\b/g, '[已脱敏]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[已脱敏]')
    .replace(/<!--[\s\S]*?-->/g, '').trim();
}

/** 透明、可预算的项目写作上下文；资料库仅在名称/别名出现时注入。 */
export function buildProjectContext(files: readonly ProjectContextFile[], requestText: string, budget = 12_000, selectedSkills: readonly string[] = []): ProjectContextResult {
  const instructions = files.filter(file => file.kind === 'instructions').sort((a, b) => (a.scope === 'project' ? 0 : 1) - (b.scope === 'project' ? 0 : 1));
  const styles = files.filter(file => file.kind === 'style').sort((a, b) => (a.scope === 'project' ? 0 : 1) - (b.scope === 'project' ? 0 : 1));
  const lowerRequest = requestText.toLocaleLowerCase();
  const library = files.filter(file => file.kind === 'library' && [file.title, ...(file.aliases ?? [])]
    .some(name => name.length >= 2 && lowerRequest.includes(name.toLocaleLowerCase())));
  const skills = files.filter(file => file.kind === 'skill' && selectedSkills.includes(file.title));
  const memories = files.filter(file => file.kind === 'memory').sort((a, b) => (a.scope === 'project' ? 0 : 1) - (b.scope === 'project' ? 0 : 1));
  const ordered = [...instructions, ...styles, ...memories, ...library, ...skills];
  const used: ProjectContextFile[] = [];
  const omitted: ProjectContextFile[] = [];
  const sections: string[] = [];
  let length = 0;
  for (const file of ordered) {
    const content = clean(file.content);
    if (!content) continue;
    const section = `【${clean(file.title)}】\n${content}`;
    if (length + section.length > budget) {
      omitted.push(file);
      continue;
    }
    sections.push(section);
    used.push(file);
    length += section.length + 2;
  }
  return { text: sections.join('\n\n'), used, omitted };
}
