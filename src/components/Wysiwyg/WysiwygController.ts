/**
 * EditorController 适配器：把编辑会话包装成既有接口（markdown 偏移坐标系）。
 *
 * 工具栏、AI 校对与改写、翻译插入、状态栏行列与字数、大纲跳转都只依赖这个接口，
 * 因此它们在所见即所得模式下无需改动即可继续工作。
 *
 * 偏移一致性约定：`getSelection()` 会先 flush 挂起的输入再读取，因此「读选区 → 用这对
 * 偏移做替换」的既有调用方（工具栏、AI）始终拿到最新偏移；`replaceRange` 只做 flush，
 * 不再重算调用方给的偏移。
 */
import { countLines, lineAtOffset, offsetOfLine } from '../../utils/wysiwyg/textLines.ts';
import { rectOfRange, revealElement } from './domCaret.ts';
import type { WysiwygSession } from './wysiwygSession';
import type { EditorController, EditorDispatchSpec, EditorLine } from '../../types/editor';
import type { GhostKeyEvent, ReviewDecoration } from '../../utils/reviewModel.ts';

export interface WysiwygControllerDeps {
  session: WysiwygSession;
  tabId?: string | null;
  /** 标签或文档快照已变化时拒绝写操作；读操作仍可用于安全交接。 */
  isCurrentDocument?: () => boolean;
  /** 提交块源码编辑器等局部草稿。 */
  flushLocalEdits?: () => void;
  /** 编辑表面的滚动容器。 */
  getScrollDOM: () => HTMLElement | null;
  /** 当前选区（弹窗定位用）。 */
  getCaretRange: () => Range | null;
  focus: () => void;
  /** 目标尚未挂载时，交给外壳在渲染完成后定位。 */
  deferReveal?: (offset: number | null) => void;
}

export function createWysiwygController(deps: WysiwygControllerDeps): EditorController {
  const { session } = deps;
  let fallbackScroll: HTMLElement | null = null;

  const scrollHost = (): HTMLElement => {
    const element = deps.getScrollDOM();
    if (element) return element;
    if (!fallbackScroll) fallbackScroll = document.createElement('div');
    return fallbackScroll;
  };

  const selectionRange = () => session.getSelectionOffsets();
  const isCurrentDocument = () => deps.isCurrentDocument?.() ?? true;
  let ghostText: { anchor: number; text: string; revision: string | number } | null = null;
  let reviewDecorations: ReviewDecoration[] = [];
  let decorationLayer: HTMLDivElement | null = null;
  const reviewKeyListeners = new Set<(event: GhostKeyEvent) => boolean>();
  const renderReviewLayer = () => {
    const host = deps.getScrollDOM();
    if (!host) return;
    if (!decorationLayer || decorationLayer.parentElement !== host) {
      decorationLayer = host.ownerDocument.createElement('div');
      decorationLayer.className = 'wysiwyg-review-layer';
      decorationLayer.setAttribute('aria-hidden', 'true');
      host.appendChild(decorationLayer);
    }
    decorationLayer.replaceChildren();
    const hostRect = host.getBoundingClientRect();
    const add = (kind: ReviewDecoration['kind'] | 'ghost', offset: number, text: string) => {
      const range = session.rangeOfOffset(Math.max(0, Math.min(offset, session.getSource().length)));
      const rect = range ? rectOfRange(range) : null;
      if (!rect || !decorationLayer) return;
      const node = host.ownerDocument.createElement('span');
      node.className = `wysiwyg-review-decoration ${kind}`;
      node.textContent = kind === 'comment' ? '批注' : kind === 'comment-stale' ? '批注已失效' : text;
      node.style.left = `${rect.left - hostRect.left + host.scrollLeft}px`;
      node.style.top = `${rect.top - hostRect.top + host.scrollTop}px`;
      if (kind === 'comment' || kind === 'comment-stale') node.title = text;
      decorationLayer.appendChild(node);
    };
    if (ghostText) add('ghost', ghostText.anchor, ghostText.text);
    for (const decoration of reviewDecorations) add(decoration.kind, decoration.from, decoration.text || '');
  };
  const flushEdits = () => {
    session.flushWriteBack();
    deps.flushLocalEdits?.();
  };
  // 状态栏/工具栏会频繁读选区；只结算正文 DOM，不提前处置独立的块源码草稿。
  const flushInput = () => session.flushWriteBack();

  const revealOffset = (offset: number) => {
    const element = session.locateElementOfOffset(offset);
    if (element) {
      deps.deferReveal?.(null);
      revealElement(element, deps.getScrollDOM());
    } else if (deps.deferReveal) {
      deps.deferReveal(offset);
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const target = session.locateElementOfOffset(offset);
        if (target) revealElement(target, deps.getScrollDOM());
      });
    }
  };

  const controller: EditorController = {
    tabId: deps.tabId,
    surface: 'wysiwyg',
    get scrollDOM() { return scrollHost(); },
    getScrollTop: () => deps.getScrollDOM()?.scrollTop ?? 0,
    getScrollHeight: () => deps.getScrollDOM()?.scrollHeight ?? 0,
    getClientHeight: () => deps.getScrollDOM()?.clientHeight ?? 0,
    getTopForLineNumber: (lineNumber) => {
      const element = session.locateElementOfOffset(offsetOfLine(session.getSource(), lineNumber));
      return element?.offsetTop ?? 0;
    },
    setScrollTop: (top) => {
      const element = deps.getScrollDOM();
      if (element) element.scrollTop = top;
    },
    onScroll: (listener) => {
      const element = deps.getScrollDOM();
      if (!element) return () => undefined;
      element.addEventListener('scroll', listener, { passive: true });
      return () => element.removeEventListener('scroll', listener);
    },
    state: {
      get selection() {
        const { from, to } = selectionRange();
        return { main: { from, to, empty: from === to } };
      },
      sliceDoc: (from, to) => { flushInput(); return session.getSource().slice(from, to); },
      doc: {
        get length() { return session.getSource().length; },
        get lines() { return countLines(session.getSource()); },
        lineAt: (offset: number) => lineAtOffset(session.getSource(), offset) as EditorLine,
        line: (lineNumber: number) => lineAtOffset(session.getSource(), offsetOfLine(session.getSource(), lineNumber)) as EditorLine,
      },
      update: (spec) => spec,
    },
    dispatch: (spec: EditorDispatchSpec) => {
      if (!isCurrentDocument()) return;
      flushEdits();
      const selection = spec.selection?.main ?? spec.selection;
      const changes = spec.changes;
      if (changes) {
        const from = changes.from;
        const to = changes.to ?? from;
        const caret = selection?.from ?? selection?.anchor ?? from + (changes.insert?.length ?? 0);
        session.replaceRange(from, to, changes.insert ?? '', caret);
        if (selection) session.setSelectionOffsets(caret, selection.to ?? selection.head ?? caret);
        if (spec.scrollIntoView) revealOffset(caret);
        return;
      }
      if (selection) {
        const from = selection.from ?? selection.anchor ?? 0;
        const to = selection.to ?? selection.head ?? from;
        session.setSelectionOffsets(from, to);
        if (spec.scrollIntoView) revealOffset(from);
      }
    },
    getValue: () => {
      flushInput();
      return session.getSource();
    },
    flushPendingEdits: flushEdits,
    resetValue: (content) => {
      if (isCurrentDocument()) session.resetSource(content);
    },
    getSelection: () => {
      // 先落盘再读：否则调用方拿到的偏移会落后于用户刚敲的内容。
      flushInput();
      session.prepareExternalEdit();
      const { from, to } = selectionRange();
      return { from, to, empty: from === to };
    },
    getText: (from, to) => { flushInput(); return session.getSource().slice(from, to); },
    replaceRange: (from, to, text, selection) => {
      if (!isCurrentDocument()) return;
      flushEdits();
      session.replaceRange(from, to, text, selection?.from);
      if (selection) session.setSelectionOffsets(selection.from, selection.to);
    },
    setSelection: (from, to) => {
      if (isCurrentDocument()) session.setSelectionOffsets(from, to);
    },
    lineAt: (offset) => lineAtOffset(session.getSource(), offset) as EditorLine,
    line: (lineNumber) => lineAtOffset(session.getSource(), offsetOfLine(session.getSource(), lineNumber)) as EditorLine,
    coordsAtPos: (offset) => {
      const range = session.rangeOfOffset(offset) ?? deps.getCaretRange();
      const rect = range ? rectOfRange(range) : null;
      if (!rect) return null;
      // x/y 与源码编辑器（Monaco）保持一致：y 取选区底边，弹窗据此出现在光标下方。
      return { left: rect.left, bottom: rect.bottom, x: rect.left, y: rect.bottom };
    },
    focus: () => deps.focus(),
    undo: () => {
      if (isCurrentDocument()) { flushEdits(); session.handleUndo(); }
    },
    redo: () => {
      if (isCurrentDocument()) { flushEdits(); session.handleRedo(); }
    },
    revealOffset,
    getRevision: () => { flushInput(); return session.getContentRevision(); },
    setGhostText: suggestion => { ghostText = suggestion; renderReviewLayer(); },
    setReviewDecorations: decorations => { reviewDecorations = decorations; renderReviewLayer(); },
    onReviewKeyDown: listener => {
      reviewKeyListeners.add(listener);
      const host = deps.getScrollDOM();
      const handleKeyDown = (event: KeyboardEvent) => {
        for (const reviewListener of reviewKeyListeners) {
          if (reviewListener(event)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
      };
      host?.addEventListener('keydown', handleKeyDown, true);
      return () => {
        reviewKeyListeners.delete(listener);
        host?.removeEventListener('keydown', handleKeyDown, true);
      };
    },
  };

  return controller;
}
