export interface FocusedDocumentEditor {
  tabId: string;
  flushPendingEdits?: () => void;
  undo: () => void;
  redo: () => void;
  focus: () => void;
}

let focusedSecondaryEditor: FocusedDocumentEditor | null = null;
let listenerInstalled = false;

export function setFocusedSecondaryEditor(editor: FocusedDocumentEditor | null): void {
  focusedSecondaryEditor = editor;
}

export function getFocusedSecondaryEditor(): FocusedDocumentEditor | null {
  return focusedSecondaryEditor;
}

/** Keep native menu actions on the last focused document without changing the active tab. */
export function installEditorFocusTracking(): void {
  if (listenerInstalled || typeof window === 'undefined') return;
  listenerInstalled = true;
  const clearOutsideSecondary = (target: EventTarget | null) => {
    if (target instanceof Element && !target.closest('.secondary-editor-pane')) {
      setFocusedSecondaryEditor(null);
    }
  };
  window.addEventListener('focusin', event => clearOutsideSecondary(event.target));
  // 侧栏等区域点击时不一定产生 focusin，原生菜单仍应跟随最近实际点击的文档。
  window.addEventListener('pointerdown', event => clearOutsideSecondary(event.target), true);
}
