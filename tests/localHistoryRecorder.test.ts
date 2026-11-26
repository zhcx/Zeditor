import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalHistoryRecorder } from '../src/services/localHistoryRecorder.ts';

test('本地历史只在保存完成或内容变化时记录已落盘文档', async () => {
  const calls: Array<{ path: string; content: string; label: string }> = [];
  const recorder = new LocalHistoryRecorder(async (documentId, path, content, _encoding, label) => {
    calls.push({ path, content, label });
    return { versionId: documentId, documentId, path, createdAt: '', sha256: '', size: content.length, encoding: 'utf-8', label };
  });
  const base = { id: 'tab', title: 'a.md', path: 'C:/a.md', content: '第一版', modified: false, encoding: 'utf-8', fileVersion: { sha256: 'a', size: 3 } };
  await recorder.observe([base]);
  assert.equal(calls.length, 1);
  await recorder.observe([base]);
  assert.equal(calls.length, 1);
  await recorder.observe([{ ...base, content: '第二版', modified: true, fileVersion: { sha256: 'b', size: 3 } }]);
  assert.equal(calls.length, 1);
  await recorder.observe([{ ...base, content: '第二版', fileVersion: { sha256: 'b', size: 3 } }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].label, '自动保存');
});

test('文档重命名迁移本地历史身份', async () => {
  const migrations: string[][] = [];
  const recorder = new LocalHistoryRecorder(async () => ({} as never), async (...args) => { migrations.push(args); });
  await recorder.observe([{ id: 'tab', title: 'old.md', path: 'C:/old.md', content: '内容', modified: false, fileVersion: { sha256: 'a', size: 2 } }]);
  await recorder.observe([{ id: 'tab', title: 'new.md', path: 'C:/new.md', content: '内容', modified: false, fileVersion: { sha256: 'a', size: 2 } }]);
  assert.equal(migrations.length, 1);
  assert.equal(migrations[0][2], 'C:/new.md');
});

test('另存为不会把原文件历史迁移到新文件', async () => {
  const migrations: string[][] = [];
  const recorder = new LocalHistoryRecorder(async () => ({} as never), async (...args) => { migrations.push(args); });
  await recorder.observe([{ id: 'tab', title: 'old.md', path: 'C:/old.md', content: '内容', modified: false, fileVersion: { sha256: 'a', size: 2 } }]);
  await recorder.observe([{ id: 'tab', title: 'copy.md', path: 'C:/copy.md', content: '内容', modified: false, fileVersion: { sha256: 'a', size: 2 }, saveAsFromPath: 'C:/old.md' }]);
  assert.equal(migrations.length, 0);
});

test('未保存文档不进入本地历史', async () => {
  let called = false;
  const recorder = new LocalHistoryRecorder(async () => { called = true; return {} as never; });
  await recorder.observe([{ id: 'tab', title: '未命名', path: null, content: '草稿', modified: true }]);
  assert.equal(called, false);
});
