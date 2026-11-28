import test from 'node:test';
import assert from 'node:assert/strict';
import { scanMigrationVault } from '../src/services/migrationScan.ts';

test('迁移扫描保留 Obsidian 配置与附件相对路径', async () => {
  const service = async (command: string, args: Record<string, unknown> = {}) => {
    const path = String(args.path);
    if (command === 'read_folder_readonly') {
      if (path === 'C:/vault') return [
        { name: '.obsidian', path: 'C:/vault/.obsidian', isDirectory: true },
        { name: 'assets', path: 'C:/vault/assets', isDirectory: true },
        { name: 'Alpha.md', path: 'C:/vault/Alpha.md', isDirectory: false },
      ];
      if (path.endsWith('.obsidian')) return [{ name: 'app.json', path: 'C:/vault/.obsidian/app.json', isDirectory: false }];
      if (path.endsWith('/assets')) return [{ name: 'image.png', path: 'C:/vault/assets/image.png', isDirectory: false }];
      return [];
    }
    return { content: '# Alpha', encoding: 'utf-8' };
  };
  const files = await scanMigrationVault('C:/vault', service);
  assert.deepEqual(files.map(file => file.path), ['.obsidian/app.json', 'Alpha.md', 'assets/image.png']);
  assert.equal(files.find(file => file.path === 'Alpha.md')?.content, '# Alpha');
});
