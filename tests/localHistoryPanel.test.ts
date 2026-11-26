import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('本地历史面板按文件身份加载且恢复不直接覆盖磁盘', () => {
  const path = 'src/components/Sidebar/LocalHistoryPanel.tsx';
  assert.equal(existsSync(path), true);
  const source = readFileSync(path, 'utf8');
  assert.match(source, /documentIdForPath/);
  assert.match(source, /localHistoryService\.list/);
  assert.match(source, /localHistoryService\.read/);
  assert.match(source, /updateTabContent/);
  assert.doesNotMatch(source, /webdav_restore_version|s3_restore_version/);
});
