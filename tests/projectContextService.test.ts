import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProjectContextService } from '../src/services/projectContext.ts';

test('公开保存包装器保留调用方的文件版本', () => {
  const source = readFileSync(new URL('../src/services/projectContext.ts', import.meta.url), 'utf8');
  assert.match(source, /saveProjectContextFile\(path: string, content: string, expectedVersion\?:/);
  assert.match(source, /\.save\(path, content, expectedVersion\)/);
});

test('项目上下文服务读取项目与全局配置并容忍缺失文件', async () => {
  const reads: string[] = [];
  const service = createProjectContextService(async (command, args = {}) => {
    if (command === 'read_folder_readonly') return [];
    if (command === 'read_text_document') {
      reads.push(String(args.path));
      if (String(args.path).endsWith('.zeditor/agent.md')) return { content: '保持中文', encoding: 'utf-8', fileVersion: { size: 12, sha256: 'a' } };
      throw new Error('not found');
    }
    return undefined;
  }, 'C:/config');
  const result = await service.load('C:/vault');
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].kind, 'instructions');
  assert.equal(result.files[0].scope, 'project');
  assert.deepEqual(result.files[0].fileVersion, { size: 12, sha256: 'a' });
  assert.ok(reads.includes('C:/config/agent.md'));
  assert.ok(reads.includes('C:/vault/.zeditor/agent.md'));
});

test('保存项目上下文使用读取时的版本做原子检查', async () => {
  const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
  const service = createProjectContextService(async (command, args = {}) => {
    calls.push({ command, args });
    if (command === 'read_text_document') return { content: '旧内容', encoding: 'utf-8', fileVersion: { size: 9, sha256: 'a' } };
    if (command === 'save_file_content_checked') return { status: 'saved', fileVersion: { size: 12, sha256: 'b' }, current: null };
    return undefined;
  }, 'C:/config');
  const version = await service.save('C:/vault/.zeditor/style.md', '句子简短。', { size: 9, sha256: 'a' });
  assert.deepEqual(version, { size: 12, sha256: 'b' });
  const save = calls.find(call => call.command === 'save_file_content_checked')!;
  assert.equal(save.args.path, 'C:/vault/.zeditor/style.md');
  assert.equal(save.args.content, '句子简短。');
  assert.deepEqual(save.args.expectedVersion, { size: 9, sha256: 'a' });
});

test('项目上下文外部冲突不会覆盖文件', async () => {
  const service = createProjectContextService(async command => {
    if (command === 'save_file_content_checked') return { status: 'conflict', fileVersion: { size: 9, sha256: 'external' }, current: null };
    return undefined;
  }, 'C:/config');
  await assert.rejects(service.save('C:/vault/.zeditor/style.md', '覆盖', { size: 9, sha256: 'a' }), /外部修改|冲突/);
});

test('新建项目上下文保存后立即取得文件版本', async () => {
  let reads = 0;
  const service = createProjectContextService(async (command) => {
    if (command === 'read_text_document') {
      reads += 1;
      if (reads === 1) throw new Error('not found');
      return { content: '内容', encoding: 'utf-8', fileVersion: { size: 6, sha256: 'new' } };
    }
    if (command === 'create_file_exclusive') return true;
    return undefined;
  }, 'C:/config');
  const version = await service.save('C:/vault/.zeditor/new.md', '内容');
  assert.deepEqual(version, { size: 6, sha256: 'new' });
});

test('已有上下文但版本未知时要求刷新而不是覆盖', async () => {
  const service = createProjectContextService(async command => {
    if (command === 'read_text_document') return { content: '外部内容', encoding: 'utf-8', fileVersion: null };
    return undefined;
  }, 'C:/config');
  await assert.rejects(service.save('C:/vault/.zeditor/agent.md', '旧快照'), /版本未知/);
});

test('新项目上下文使用排他创建且不覆盖同名文件', async () => {
  const calls: string[] = [];
  const service = createProjectContextService(async (command) => {
    calls.push(command);
    if (command === 'read_text_document') throw new Error('not found');
    if (command === 'create_file_exclusive') return false;
    return undefined;
  }, 'C:/config');
  await assert.rejects(service.save('C:/vault/.zeditor/new.md', '内容'), /已存在|冲突/);
  assert.ok(calls.includes('create_file_exclusive'));
});
