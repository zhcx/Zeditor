import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anchorReviewComment,
  buildReviewHunks,
  canAcceptGhostText,
  decideReviewHunk,
  documentRevision,
  normalizeReviewDocumentKey,
  remainingReviewHunks,
  revalidateReviewComments,
  serializeReviewComments,
  validateReviewProposal,
  type ReviewProposalLike,
} from '../src/utils/reviewModel.ts';

const proposal = (before: string, after: string, from = 7): ReviewProposalLike => ({
  source: { activeTabId: 'tab-1', content: `prefix\n${before}\nsuffix` },
  revision: documentRevision(`prefix\n${before}\nsuffix`),
  before,
  after,
  from,
  to: from + before.length,
  reviewBase: { before, after, from },
  reviewDecisions: {},
});

test('builds separate modification hunks with document offsets and reversible text', () => {
  const before = 'alpha one omega';
  const after = 'alpha ONE omega!';
  const hunks = buildReviewHunks(before, after, 20);
  assert.equal(hunks.length, 2);
  assert.deepEqual(hunks.map(h => [h.from, h.to, h.before, h.after]), [
    [26, 29, 'one', 'ONE'],
    [35, 35, '', '!'],
  ]);
  const applied = hunks.reduce((text, h) => text.slice(0, h.from - 20) + h.after + text.slice(h.to - 20), before);
  assert.equal(applied, after);
});

test('large replacements stay bounded and remain one coherent hunk', () => {
  const hunks = buildReviewHunks('a'.repeat(1200), 'b'.repeat(1200));
  assert.equal(hunks.length, 1);
  assert.equal(hunks[0].before.length, 1200);
  assert.equal(hunks[0].after.length, 1200);
});

test('accepting one hunk rebases the remaining proposal and writes only that hunk', () => {
  const initial = proposal('red green blue', 'RED GREEN BLUE');
  const hunks = remainingReviewHunks(initial);
  assert.equal(hunks.length, 3);
  const accepted = decideReviewHunk(initial, hunks[1].id, 'accepted');
  assert.equal(accepted.appliedContent, 'prefix\nred GREEN blue\nsuffix');
  assert.equal(accepted.proposal.source.content, accepted.appliedContent);
  assert.deepEqual(remainingReviewHunks(accepted.proposal).map(h => h.before), ['red', 'blue']);
  const rejected = decideReviewHunk(accepted.proposal, remainingReviewHunks(accepted.proposal)[0].id, 'rejected');
  assert.equal(rejected.appliedContent, null);
  assert.equal(rejected.proposal.after, 'red GREEN BLUE');
});

test('length-changing accepted hunks preserve later offsets in the projected target', () => {
  const initial = proposal('red green blue', 'red VERY green blue EXTRA');
  const first = remainingReviewHunks(initial)[0];
  const accepted = decideReviewHunk(initial, first.id, 'accepted');
  assert.equal(accepted.appliedContent, 'prefix\nred VERY green blue\nsuffix');
  assert.equal(accepted.proposal.before, 'red VERY green blue');
  assert.equal(accepted.proposal.after, 'red VERY green blue EXTRA');
  const second = remainingReviewHunks(accepted.proposal)[0];
  const finished = decideReviewHunk(accepted.proposal, second.id, 'accepted');
  assert.equal(finished.appliedContent, 'prefix\nred VERY green blue EXTRA\nsuffix');
  assert.equal(finished.proposal.before, finished.proposal.after);
});

test('snapshot, revision and repeated-text range must all match before applying', () => {
  const initial = proposal('same same', 'first same');
  const hunk = remainingReviewHunks(initial)[0];
  const changedTab = { ...initial, source: { ...initial.source, activeTabId: 'tab-2' } };
  assert.equal(validateReviewProposal(changedTab, changedTab.source.content, initial.revision, 'tab-1').ok, false);
  assert.equal(validateReviewProposal(initial, initial.source.content, `${initial.revision}:old`).ok, false);
  const wrongCurrentText = initial.source.content.replace('same same', 'xx same');
  assert.equal(validateReviewProposal(initial, wrongCurrentText, initial.revision).ok, false);
  assert.throws(() => decideReviewHunk(initial, hunk.id, 'accepted', wrongCurrentText, initial.revision), /文档已变化|无法安全/);
});

test('ghost Tab requires an unmodified, non-composing plain Tab at the unchanged cursor', () => {
  const base = { key: 'Tab', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, isComposing: false, keyCode: 9 };
  assert.equal(canAcceptGhostText(base, 4, { from: 4, to: 4, empty: true }, 7, 7), true);
  assert.equal(canAcceptGhostText({ ...base, shiftKey: true }, 4, { from: 4, to: 4, empty: true }, 7, 7), false);
  assert.equal(canAcceptGhostText({ ...base, ctrlKey: true }, 4, { from: 4, to: 4, empty: true }, 7, 7), false);
  assert.equal(canAcceptGhostText({ ...base, isComposing: true }, 4, { from: 4, to: 4, empty: true }, 7, 7), false);
  assert.equal(canAcceptGhostText(base, 4, { from: 3, to: 4, empty: false }, 7, 7), false);
  assert.equal(canAcceptGhostText(base, 4, { from: 4, to: 4, empty: true }, 7, 8), false);
});

test('review paths normalize separators and Windows case without conflating unsaved tabs', () => {
  assert.equal(normalizeReviewDocumentKey('C:\\Work\\Note.md', 'a'), 'file:c:/work/note.md');
  assert.equal(normalizeReviewDocumentKey(null, 'a'), 'tab:a');
  assert.notEqual(normalizeReviewDocumentKey(null, 'a'), normalizeReviewDocumentKey(null, 'b'));
});

test('comments keep quote context and become stale instead of relocating repeated text', () => {
  const content = 'same context same context';
  const comment = anchorReviewComment({ id: 'c1', documentKey: 'tab:a', from: 13, to: 17, quote: 'same', body: 'check', author: '我', createdAt: 1, resolved: false }, content);
  assert.equal(comment.stale, false);
  assert.equal(revalidateReviewComments([comment], content)[0].stale, false);
  assert.equal(revalidateReviewComments([comment], 'same changed same context')[0].stale, true);
  const exported = JSON.parse(serializeReviewComments([comment])) as { comments: Array<{ quote: string; stale: boolean }> };
  assert.equal(exported.comments[0].quote, 'same');
  assert.equal(exported.comments[0].stale, false);
});
