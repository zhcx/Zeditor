export type PluginPermission = 'commands' | 'slash' | 'panel';
export type PluginAction =
  | { type: 'insert-text'; text: string }
  | { type: 'dispatch'; event: 'zeditor-open-knowledge' | 'zeditor-add-review-note' | 'zeditor-toggle-split' };

export interface PluginCommand {
  id: string;
  title: string;
  action: PluginAction;
}
export interface PluginSlashItem { id: string; title: string; insert: string }
export interface PluginPanel { id: string; title: string; markdown: string }
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  permissions: PluginPermission[];
  contributions: { commands: PluginCommand[]; slash: PluginSlashItem[]; panels: PluginPanel[] };
}

const ID = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const PERMISSIONS = new Set<PluginPermission>(['commands', 'slash', 'panel']);
const EVENTS = new Set(['zeditor-open-knowledge', 'zeditor-add-review-note', 'zeditor-toggle-split']);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('插件 manifest 格式无效');
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function action(value: unknown): PluginAction {
  const item = record(value);
  if (item.type === 'insert-text' && typeof item.text === 'string' && item.text.length <= 20_000) return { type: 'insert-text', text: item.text };
  if (item.type === 'dispatch' && typeof item.event === 'string' && EVENTS.has(item.event)) return { type: 'dispatch', event: item.event as PluginAction & never };
  throw new Error('插件动作不受支持或包含可执行代码');
}

/** 只接受声明式贡献；不接受 entrypoint、脚本、网络或文件系统权限。 */
export function parsePluginManifest(source: string): PluginManifest {
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { throw new Error('插件 manifest 不是有效 JSON'); }
  const item = record(raw);
  for (const key of ['code', 'script', 'entrypoint', 'module', 'url']) {
    if (key in item) throw new Error('安全插件 MVP 不允许代码或远程入口');
  }
  if (typeof item.id !== 'string' || !ID.test(item.id)) throw new Error('插件 id 格式无效');
  if (!item.version || !/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(text(item.version))) throw new Error('插件 version 格式无效');
  if (!Array.isArray(item.permissions) || item.permissions.some(permission => !PERMISSIONS.has(permission))) throw new Error('插件权限不受支持');
  const permissions = [...new Set(item.permissions)] as PluginPermission[];
  const contributions = record(item.contributions ?? {});
  const ids = new Set<string>();
  const unique = (kind: string, id: unknown) => {
    const key = `${kind}:${String(id)}`;
    if (typeof id !== 'string' || !ID.test(id) || ids.has(key)) throw new Error('插件贡献 id 无效或重复');
    ids.add(key);
  };
  const commands: PluginCommand[] = [];
  if (permissions.includes('commands')) {
    if (!Array.isArray(contributions.commands)) throw new Error('commands 贡献必须是数组');
    for (const value of contributions.commands) {
      const command = record(value);
      unique('command', command.id);
      if (!text(command.title).trim()) throw new Error('插件命令缺少标题');
      commands.push({ id: command.id as string, title: text(command.title), action: action(command.action) });
    }
  }
  const slash: PluginSlashItem[] = [];
  if (permissions.includes('slash')) {
    if (!Array.isArray(contributions.slash)) throw new Error('slash 贡献必须是数组');
    for (const value of contributions.slash) {
      const entry = record(value);
      unique('slash', entry.id);
      if (!text(entry.title).trim() || typeof entry.insert !== 'string' || entry.insert.length > 20_000) throw new Error('插件斜杠命令无效');
      slash.push({ id: entry.id as string, title: text(entry.title), insert: entry.insert });
    }
  }
  const panels: PluginPanel[] = [];
  if (permissions.includes('panel')) {
    if (!Array.isArray(contributions.panels)) throw new Error('panel 贡献必须是数组');
    for (const value of contributions.panels) {
      const panel = record(value);
      unique('panel', panel.id);
      if (!text(panel.title).trim() || typeof panel.markdown !== 'string' || panel.markdown.length > 50_000) throw new Error('插件面板无效');
      panels.push({ id: panel.id as string, title: text(panel.title), markdown: panel.markdown });
    }
  }
  return {
    id: item.id,
    name: text(item.name, item.id),
    version: text(item.version),
    description: text(item.description),
    permissions,
    contributions: { commands, slash, panels },
  };
}

export function pluginCommands(manifest: PluginManifest) {
  return manifest.contributions.commands.map(command => ({ ...command, pluginId: manifest.id, pluginName: manifest.name }));
}

export function pluginSlashItems(manifest: PluginManifest) {
  return manifest.contributions.slash.map(item => ({ ...item, pluginId: manifest.id }));
}
