import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlockSourceDraft, resolveBlockSourceDraftIndex } from '../src/utils/wysiwyg/blockSourceDraft.ts';

test('an unchanged local draft leaves the current source untouched', () => {
  assert.equal(resolveBlockSourceDraft('old', 'external', 'old', () => true), 'external');
});

test('a dirty draft is committed automatically while its base source is unchanged', () => {
  assert.equal(resolveBlockSourceDraft('old', 'old', 'draft', () => false), 'draft');
});

test('a dirty draft never silently overwrites a newer external source', () => {
  assert.equal(resolveBlockSourceDraft('old', 'external', 'draft', () => false), 'external');
});

test('the user can explicitly choose to apply a conflicting draft', () => {
  assert.equal(resolveBlockSourceDraft('old', 'external', 'draft', () => true), 'draft');
});

test('a locally edited block remains identifiable after an external content update', () => {
  const blocks = [
    { kind: 'paragraph', source: 'before' },
    { kind: 'table', source: 'external table' },
    { kind: 'paragraph', source: 'after' },
  ];
  assert.equal(resolveBlockSourceDraftIndex({
    index: 1,
    baseSource: 'base table',
    kind: 'table',
    blockCount: 3,
    previousSource: 'before',
    nextSource: 'after',
  }, blocks), 1);
});

test('a locally edited block is rejected when the document structure changed', () => {
  const blocks = [
    { kind: 'paragraph', source: 'before' },
    { kind: 'paragraph', source: 'inserted' },
    { kind: 'table', source: 'external table' },
    { kind: 'paragraph', source: 'after' },
  ];
  assert.equal(resolveBlockSourceDraftIndex({
    index: 1,
    baseSource: 'base table',
    kind: 'table',
    blockCount: 3,
    previousSource: 'before',
    nextSource: 'after',
  }, blocks), -1);
});

test('a locally edited block is rejected when its neighbors no longer identify it', () => {
  const blocks = [
    { kind: 'paragraph', source: 'external before' },
    { kind: 'table', source: 'external table' },
    { kind: 'paragraph', source: 'after' },
  ];
  assert.equal(resolveBlockSourceDraftIndex({
    index: 1,
    baseSource: 'base table',
    kind: 'table',
    blockCount: 3,
    previousSource: 'before',
    nextSource: 'after',
  }, blocks), -1);
});
