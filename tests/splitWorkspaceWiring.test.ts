import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('分栏工作区提供独立标签选择、方向切换和可键盘拖动分隔条', () => {
  const path = 'src/components/Editor/SplitEditorWorkspace.tsx';
  assert.equal(existsSync(path), true);
  const source = readFileSync(path, 'utf8');
  assert.match(source, /SecondaryEditor/);
  assert.match(source, /useWorkspaceLayoutStore/);
  assert.match(source, /role="separator"/);
  assert.match(source, /ArrowLeft|ArrowRight/);
  assert.match(source, /setOrientation/);
  assert.doesNotMatch(source, /setActiveTab/);
});
