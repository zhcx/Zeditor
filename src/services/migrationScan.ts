import { invoke } from '@tauri-apps/api/core';
import type { MigrationFile } from '../utils/migration.ts';

interface FileNode { name: string; path: string; isDirectory: boolean }
type Invoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
const SKIP = new Set(['.git', 'node_modules', 'target']);

export async function scanMigrationVault(root: string, invoker: Invoker = invoke as Invoker): Promise<MigrationFile[]> {
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const queue = [root];
  const visited = new Set<string>();
  const files: MigrationFile[] = [];
  while (queue.length && files.length < 5000) {
    const directory = queue.shift()!;
    if (visited.has(directory)) continue;
    visited.add(directory);
    const nodes = await invoker<FileNode[]>('read_folder_readonly', { path: directory });
    for (const node of nodes) {
      if (node.isDirectory) {
        if (!SKIP.has(node.name)) queue.push(node.path);
        continue;
      }
      const relative = node.path.replace(/\\/g, '/').slice(normalizedRoot.replace(/\\/g, '/').length + 1);
      if (/\.md$/i.test(node.name)) {
        try {
          const document = await invoker<{ content: string }>('read_text_document', { path: node.path });
          files.push({ path: relative, content: document.content });
        } catch { /* 单个不可读文件不阻断迁移分析 */ }
      } else {
        files.push({ path: relative, content: '' });
      }
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
