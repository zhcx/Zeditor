export interface ReviewHunk {
  id: string;
  from: number;
  to: number;
  before: string;
  after: string;
}

export type ReviewDecision = 'accepted' | 'rejected';

export interface ReviewProposalLike {
  source: { activeTabId: string | null; content: string };
  revision?: string | number;
  before: string;
  after: string;
  from: number;
  to: number;
  reviewBase?: { before: string; after: string; from: number };
  reviewDecisions?: Record<string, ReviewDecision>;
}

export interface ReviewDecoration {
  id: string;
  from: number;
  to: number;
  kind: 'ghost' | 'addition' | 'deletion' | 'comment' | 'comment-stale';
  text?: string;
}

/** Content-derived revision used when an adapter does not expose its own counter. */
export function documentRevision(content: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < content.length; index += 1) {
    const code = content.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `${content.length}:${first.toString(16)}:${second.toString(16)}`;
}

function lcsTable(before: string, after: string): Uint32Array | null {
  if (before.length * after.length > 1_000_000) return null;
  const width = after.length + 1;
  const table = new Uint32Array((before.length + 1) * width);
  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      table[left * width + right] = before[left] === after[right]
        ? table[(left + 1) * width + right + 1] + 1
        : Math.max(table[(left + 1) * width + right], table[left * width + right + 1]);
    }
  }
  return table;
}

/** Character-level LCS keeps Markdown punctuation and unspaced Chinese edits precise. */
export function buildReviewHunks(before: string, after: string, baseOffset = 0): ReviewHunk[] {
  if (before === after) return [];
  if (!Number.isInteger(baseOffset) || baseOffset < 0) throw new Error('审阅偏移无效');
  const hunks: ReviewHunk[] = [];
  const emit = (from: number, to: number, afterFrom: number, afterTo: number) => {
    hunks.push({
      id: `hunk-${baseOffset + from}-${baseOffset + to}-${hunks.length}`,
      from: baseOffset + from,
      to: baseOffset + to,
      before: before.slice(from, to),
      after: after.slice(afterFrom, afterTo),
    });
  };

  const table = lcsTable(before, after);
  if (!table) {
    emit(0, before.length, 0, after.length);
    return hunks;
  }
  const width = after.length + 1;
  let left = 0;
  let right = 0;
  let changeStart: { left: number; right: number } | null = null;
  const flush = () => {
    if (!changeStart) return;
    emit(changeStart.left, left, changeStart.right, right);
    changeStart = null;
  };
  while (left < before.length || right < after.length) {
    const equal = left < before.length && right < after.length && before[left] === after[right];
    if (equal) {
      flush();
      left += 1;
      right += 1;
      continue;
    }
    if (!changeStart) changeStart = { left, right };
    const addNext = right < after.length && (left === before.length || table[left * width + right + 1] >= table[(left + 1) * width + right]);
    if (addNext) right += 1;
    else left += 1;
  }
  flush();
  return hunks;
}

export function remainingReviewHunks(proposal: ReviewProposalLike): ReviewHunk[] {
  const base = proposal.reviewBase ?? { before: proposal.before, after: proposal.after, from: proposal.from };
  const decisions = proposal.reviewDecisions ?? {};
  let offsetDelta = 0;
  const remaining: ReviewHunk[] = [];
  for (const hunk of buildReviewHunks(base.before, base.after, base.from)) {
    const decision = decisions[hunk.id];
    if (decision === 'accepted') {
      offsetDelta += hunk.after.length - hunk.before.length;
    } else if (!decision) {
      // Shift only by accepted earlier hunks. Rejected hunks leave source
      // offsets untouched, and original ids remain stable for later decisions.
      remaining.push({ ...hunk, from: hunk.from + offsetDelta, to: hunk.to + offsetDelta });
    }
  }
  return remaining;
}

function projectReviewText(proposal: ReviewProposalLike): { before: string; after: string } {
  const base = proposal.reviewBase ?? { before: proposal.before, after: proposal.after, from: proposal.from };
  const decisions = proposal.reviewDecisions ?? {};
  let before = '';
  let after = '';
  let beforeCursor = 0;
  let afterCursor = 0;
  for (const hunk of buildReviewHunks(base.before, base.after, base.from)) {
    const localFrom = hunk.from - base.from;
    const localTo = hunk.to - base.from;
    const unchanged = base.before.slice(beforeCursor, localFrom);
    const afterFrom = afterCursor + unchanged.length;
    const afterTo = afterFrom + hunk.after.length;
    before += unchanged;
    after += base.after.slice(afterCursor, afterFrom);
    const decision = decisions[hunk.id];
    before += decision === 'accepted' ? hunk.after : hunk.before;
    after += decision === 'rejected' ? hunk.before : hunk.after;
    beforeCursor = localTo;
    afterCursor = afterTo;
  }
  before += base.before.slice(beforeCursor);
  after += base.after.slice(afterCursor);
  return { before, after };
}

export interface ReviewValidation {
  ok: boolean;
  reason: string;
}

export function validateReviewProposal(
  proposal: ReviewProposalLike,
  currentContent: string,
  currentRevision?: string | number,
  activeTabId?: string | null,
): ReviewValidation {
  const invalidRange = !Number.isInteger(proposal.from) || !Number.isInteger(proposal.to)
    || proposal.from < 0 || proposal.to < proposal.from || proposal.to > currentContent.length;
  if (activeTabId !== undefined && (proposal.source.activeTabId === null || proposal.source.activeTabId !== activeTabId)) {
    return { ok: false, reason: '文档已切换，无法安全应用此建议。' };
  }
  if (proposal.source.content !== currentContent) {
    return { ok: false, reason: '文档已变化，无法安全应用此建议。' };
  }
  if (proposal.revision !== undefined && currentRevision !== undefined && proposal.revision !== currentRevision) {
    return { ok: false, reason: '文档版本已变化，无法安全应用此建议。' };
  }
  if (invalidRange || currentContent.slice(proposal.from, proposal.to) !== proposal.before) {
    return { ok: false, reason: '原文锚点已变化，无法安全应用此建议。' };
  }
  for (const hunk of remainingReviewHunks(proposal)) {
    if (hunk.to > currentContent.length || currentContent.slice(hunk.from, hunk.to) !== hunk.before) {
      return { ok: false, reason: '修改块锚点已变化，无法安全应用此建议。' };
    }
  }
  return { ok: true, reason: '' };
}

export function decideReviewHunk(
  proposal: ReviewProposalLike,
  hunkId: string,
  decision: ReviewDecision,
  currentContent = proposal.source.content,
  currentRevision = proposal.revision,
): { proposal: ReviewProposalLike; hunk: ReviewHunk; appliedContent: string | null } {
  const validation = validateReviewProposal(proposal, currentContent, currentRevision);
  if (!validation.ok) throw new Error(validation.reason);
  const hunk = remainingReviewHunks(proposal).find(item => item.id === hunkId);
  if (!hunk) throw new Error('此修改块已处理或不存在。');
  const decisions = { ...(proposal.reviewDecisions ?? {}), [hunkId]: decision };
  const next: ReviewProposalLike = { ...proposal, reviewDecisions: decisions };
  const projected = projectReviewText(next);
  next.before = projected.before;
  next.after = projected.after;
  next.to = next.from + projected.before.length;
  const appliedContent = decision === 'accepted'
    ? currentContent.slice(0, hunk.from) + hunk.after + currentContent.slice(hunk.to)
    : null;
  next.source = { ...next.source, content: appliedContent ?? currentContent };
  return { proposal: next, hunk, appliedContent };
}

export function reviewProposalDecorations(proposal: ReviewProposalLike): ReviewDecoration[] {
  return remainingReviewHunks(proposal).flatMap(hunk => {
    const decorations: ReviewDecoration[] = [];
    if (hunk.before) decorations.push({ id: `${hunk.id}-delete`, from: hunk.from, to: hunk.from + hunk.before.length, kind: 'deletion', text: hunk.before });
    if (hunk.after) decorations.push({ id: `${hunk.id}-add`, from: hunk.from, to: hunk.from + hunk.after.length, kind: 'addition', text: hunk.after });
    return decorations;
  });
}

export interface GhostKeyEvent {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
  keyCode?: number;
}

export function canAcceptGhostText(
  event: GhostKeyEvent,
  anchor: number,
  selection: { from: number; to: number; empty: boolean },
  revision: string | number | undefined,
  currentRevision: string | number | undefined,
): boolean {
  return event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey
    && !event.isComposing && event.keyCode !== 229 && selection.empty && selection.from === anchor && selection.to === anchor
    && revision !== undefined && currentRevision !== undefined && revision === currentRevision;
}

export interface ReviewComment {
  id: string;
  documentKey: string;
  quote: string;
  from: number;
  to: number;
  body: string;
  author: string;
  createdAt: number;
  resolved: boolean;
  stale: boolean;
  contextBefore?: string;
  contextAfter?: string;
}

export type ReviewCommentInput = Omit<ReviewComment, 'stale' | 'contextBefore' | 'contextAfter'>;

export function anchorReviewComment(comment: ReviewCommentInput, content: string): ReviewComment {
  if (!Number.isInteger(comment.from) || !Number.isInteger(comment.to) || comment.from < 0 || comment.to <= comment.from || comment.to > content.length) {
    throw new Error('请先选择需要批注的正文。');
  }
  const quote = content.slice(comment.from, comment.to);
  if (!quote || quote !== comment.quote) throw new Error('选区已变化，请重新选择批注文字。');
  return {
    ...comment,
    quote,
    stale: false,
    contextBefore: content.slice(Math.max(0, comment.from - 32), comment.from),
    contextAfter: content.slice(comment.to, comment.to + 32),
  };
}

export function revalidateReviewComments(comments: ReviewComment[], content: string): ReviewComment[] {
  return comments.map(comment => {
    const rangeValid = Number.isInteger(comment.from) && Number.isInteger(comment.to)
      && comment.from >= 0 && comment.to <= content.length && comment.to > comment.from;
    const quoteValid = rangeValid && content.slice(comment.from, comment.to) === comment.quote;
    const beforeValid = !comment.contextBefore || content.slice(Math.max(0, comment.from - comment.contextBefore.length), comment.from) === comment.contextBefore;
    const afterValid = !comment.contextAfter || content.slice(comment.to, comment.to + comment.contextAfter.length) === comment.contextAfter;
    return quoteValid && beforeValid && afterValid ? { ...comment, stale: false } : { ...comment, stale: true };
  });
}

export function normalizeReviewDocumentKey(currentFile: string | null | undefined, tabId: string | null | undefined): string {
  if (currentFile) {
    const path = currentFile.replace(/\\/g, '/').replace(/\/+$/, '');
    return `file:${/^[a-z]:\//i.test(path) || path.startsWith('//') ? path.toLowerCase() : path}`;
  }
  return `tab:${tabId ?? 'untitled'}`;
}

export function serializeReviewComments(comments: ReviewComment[], documentKey = comments[0]?.documentKey ?? null): string {
  return JSON.stringify({
    version: 1,
    documentKey,
    exportedAt: new Date().toISOString(),
    comments,
  }, null, 2);
}
