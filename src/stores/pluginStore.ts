import { create } from 'zustand';
import { parsePluginManifest, pluginCommands, pluginSlashItems, type PluginManifest } from '../utils/pluginManifest.ts';

interface PluginRecord { manifest: PluginManifest; enabled: boolean }
interface PluginState {
  plugins: PluginRecord[];
  import: (source: string) => PluginManifest;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  commands: () => ReturnType<typeof pluginCommands>;
  slashItems: () => ReturnType<typeof pluginSlashItems>;
  panels: () => Array<{ pluginId: string; pluginName: string; id: string; title: string; markdown: string }>;
}

const STORAGE_KEY = 'zeditor.safe-plugins.v1';
function loadPlugins(): PluginRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.flatMap(record => {
      try {
        const manifest = parsePluginManifest(JSON.stringify(record.manifest));
        return [{ manifest, enabled: record.enabled !== false }];
      } catch { return []; }
    });
  } catch { return []; }
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: loadPlugins(),
  import: source => {
    const manifest = parsePluginManifest(source);
    set(state => ({ plugins: [...state.plugins.filter(record => record.manifest.id !== manifest.id), { manifest, enabled: true }] }));
    return manifest;
  },
  toggle: id => set(state => ({ plugins: state.plugins.map(record => record.manifest.id === id ? { ...record, enabled: !record.enabled } : record) })),
  remove: id => set(state => ({ plugins: state.plugins.filter(record => record.manifest.id !== id) })),
  commands: () => get().plugins.filter(record => record.enabled).flatMap(record => pluginCommands(record.manifest)),
  slashItems: () => get().plugins.filter(record => record.enabled).flatMap(record => pluginSlashItems(record.manifest)),
  panels: () => get().plugins.filter(record => record.enabled).flatMap(record => record.manifest.contributions.panels.map(panel => ({ pluginId: record.manifest.id, pluginName: record.manifest.name, ...panel }))),
}));

usePluginStore.subscribe(state => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.plugins)); } catch { /* 保留内存插件 */ }
});
