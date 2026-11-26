import { create } from 'zustand';
import {
  anchorReviewComment,
  normalizeReviewDocumentKey,
  revalidateReviewComments,
  serializeReviewComments,
  type ReviewComment,
} from '../utils/reviewModel.ts';

const STORAGE_PREFIX = 'zeditor.review.';

function readComments(documentKey: string): ReviewComment[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${documentKey}`) || '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ReviewComment => Boolean(
      item && typeof item.id === 'string' && typeof item.quote === 'string'
      && typeof item.body === 'string' && typeof item.author === 'string'
      && Number.isFinite(item.from) && Number.isFinite(item.to)
      && Number.isFinite(item.createdAt) && typeof item.resolved === 'boolean',
    )).map(item => ({ ...item, documentKey, stale: item.stale === true }));
  } catch {
    return [];
  }
}

function persistComments(documentKey: string, comments: ReviewComment[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${documentKey}`, JSON.stringify(comments));
  } catch {
    // Review remains usable in memory when storage is full or unavailable.
  }
}

interface ReviewState {
  comments: Record<string, ReviewComment[]>;
  documentKey: string;
  currentFile: string | null;
  activeTabId: string | null;
  sourceContent: string;
  setDocument: (currentFile: string | null, activeTabId: string | null, content?: string) => void;
  addComment: (selection: { from: number; to: number }, quote: string, body: string, author?: string) => string | null;
  setResolved: (id: string, resolved: boolean) => void;
  deleteComment: (id: string) => void;
  revalidate: (content: string) => void;
  exportComments: () => string;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  comments: {},
  documentKey: 'tab:untitled',
  currentFile: null,
  activeTabId: null,
  sourceContent: '',

  setDocument: (currentFile, activeTabId, content) => {
    const documentKey = normalizeReviewDocumentKey(currentFile, activeTabId);
    const saved = readComments(documentKey);
    const comments = content === undefined ? saved : revalidateReviewComments(saved, content);
    if (content !== undefined) persistComments(documentKey, comments);
    set({ documentKey, currentFile, activeTabId, sourceContent: content ?? get().sourceContent, comments: { ...get().comments, [documentKey]: comments } });
  },

  addComment: (selection, quote, body, author = '我') => {
    const state = get();
    const text = body.trim();
    if (!text) return null;
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const comment = anchorReviewComment({
        id,
        documentKey: state.documentKey,
        from: selection.from,
        to: selection.to,
        quote,
        body: text,
        author: author.trim() || '我',
        createdAt: Date.now(),
        resolved: false,
      }, state.sourceContent);
      // The caller supplies both the exact selected quote and current source;
      // repeated text is therefore checked at its original range, never relocated.
      const comments = [comment, ...(state.comments[state.documentKey] ?? [])];
      persistComments(state.documentKey, comments);
      set({ comments: { ...state.comments, [state.documentKey]: comments } });
      return id;
    } catch {
      return null;
    }
  },

  setResolved: (id, resolved) => {
    const state = get();
    const comments = (state.comments[state.documentKey] ?? []).map(comment => comment.id === id ? { ...comment, resolved } : comment);
    persistComments(state.documentKey, comments);
    set({ comments: { ...state.comments, [state.documentKey]: comments } });
  },

  deleteComment: id => {
    const state = get();
    const comments = (state.comments[state.documentKey] ?? []).filter(comment => comment.id !== id);
    persistComments(state.documentKey, comments);
    set({ comments: { ...state.comments, [state.documentKey]: comments } });
  },

  revalidate: content => {
    const state = get();
    const comments = revalidateReviewComments(state.comments[state.documentKey] ?? [], content);
    persistComments(state.documentKey, comments);
    set({ sourceContent: content, comments: { ...state.comments, [state.documentKey]: comments } });
  },

  exportComments: () => serializeReviewComments(get().comments[get().documentKey] ?? [], get().documentKey),
}));
