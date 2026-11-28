import { invoke } from '@tauri-apps/api/core';
import { MetadataIndex, normalizeNotePath, parseNoteMetadata, type NoteMetadata } from '../utils/metadataIndex.ts';

interface FileNode { name: string; path: string; isDirectory: boolean; children?: FileNode[] | null }
interface TextDocument { content: string; encoding: string }
type Invoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'target', '.zeditor']);
const MAX_SCAN_FILES = 3000;

/** 工作区元数据扫描与单篇增量更新；完整扫描由用户或侧栏刷新触发。 */
export class KnowledgeIndexService {
  private index = new MetadataIndex();
  private generation = 0;
  private scanning = false;
  private invoker: Invoker;

  constructor(invoker: Invoker = invoke as Invoker) {
    this.invoker = invoker;
  }

  all(): NoteMetadata[] { return this.index.all(); }
  get(path: string): NoteMetadata | undefined { return this.index.get(path); }
  suggest(query: string, currentPath?: string): NoteMetadata[] { return this.index.suggest(query, currentPath); }
  backlinks(path: string) { return this.index.backlinks(path); }
  unresolvedLinks() { return this.index.unresolvedLinks(); }
  unlinkedMentions(path: string) { return this.index.unlinkedMentions(path); }
  query(query: Parameters<MetadataIndex['query']>[0]) { return this.index.query(query); }
  tasks(filter?: Parameters<MetadataIndex['tasks']>[0]) { return this.index.tasks(filter); }
  calendar(month: string) { return this.index.calendar(month); }
  graph() { return this.index.graph(); }

  private cancelActiveScan(): void {
    if (!this.scanning) return;
    this.generation += 1;
    this.scanning = false;
  }

  upsert(path: string, content: string): void {
    this.cancelActiveScan();
    this.index.upsert(parseNoteMetadata(path, content));
  }

  remove(path: string): void {
    this.cancelActiveScan();
    this.index.remove(path);
  }

  rename(oldPath: string, newPath: string, content?: string): void {
    this.cancelActiveScan();
    const existing = this.index.get(oldPath);
    if (!existing) return;
    this.index.remove(oldPath);
    this.index.upsert(content === undefined
      ? { ...existing, path: normalizeNotePath(newPath) }
      : parseNoteMetadata(newPath, content, existing.modifiedAt));
  }

  cancel(): void {
    this.generation += 1;
    this.scanning = false;
  }

  async scan(root: string): Promise<{ scanned: number; errors: string[]; cancelled?: boolean; truncated?: boolean }> {
    const generation = ++this.generation;
    this.scanning = true;
    const next = new MetadataIndex();
    const errors: string[] = [];
    const queue = [root];
    const visited = new Set<string>();
    let scanned = 0;
    let truncated = false;
    while (queue.length && generation === this.generation && scanned < MAX_SCAN_FILES) {
      const directory = queue.shift()!;
      const key = normalizeNotePath(directory);
      if (visited.has(key)) continue;
      visited.add(key);
      let nodes: FileNode[];
      try {
        nodes = await this.invoker<FileNode[]>('read_folder_readonly', { path: directory });
      } catch (error) {
        errors.push(`${directory}: ${String(error)}`);
        continue;
      }
      for (const node of nodes) {
        if (generation !== this.generation) break;
        if (node.isDirectory) {
          if (!SKIP_DIRECTORIES.has(node.name) && !node.name.startsWith('.')) queue.push(node.path);
        } else if (/\.md$/i.test(node.name)) {
          if (scanned >= MAX_SCAN_FILES) {
            truncated = true;
            break;
          }
          try {
            const document = await this.invoker<TextDocument>('read_text_document', { path: node.path });
            next.upsert(parseNoteMetadata(node.path, document.content));
            scanned += 1;
          } catch (error) {
            errors.push(`${node.path}: ${String(error)}`);
          }
        }
      }
    }
    truncated = truncated || queue.length > 0;
    if (generation === this.generation) {
      this.index = next;
      this.scanning = false;
      return { scanned, errors, cancelled: false, truncated };
    }
    return { scanned, errors, cancelled: true, truncated };
  }
}

export const knowledgeIndexService = new KnowledgeIndexService();
