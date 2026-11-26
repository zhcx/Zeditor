import type { EditorController } from '../types/editor.ts';
import type { EditorDocumentIdentityState } from './editorDocumentIdentity.ts';
import { editorSurface, type EditorSurface } from './editorViewMemory.ts';
import type { WorkspaceMode } from './workspaceMode.ts';

/** Passive effects may execute after the store has advanced beyond their render snapshot. */
export function resolveExternalEditorSource(
  state: EditorDocumentIdentityState,
  renderedTabId: string | null,
): string | null {
  if (!renderedTabId || renderedTabId !== state.activeTabId) return null;
  const tab = state.tabs.find(item => item.id === renderedTabId);
  if (!tab || tab.content !== state.content) return null;
  return state.content;
}

/** During a fast mode switch, the controller is more authoritative than the pending UI mode. */
export function resolveEditorControllerSurface(
  mode: WorkspaceMode,
  controller: Pick<EditorController, 'surface'> | null,
): EditorSurface | null {
  if (!controller) return null;
  return controller.surface ?? editorSurface(mode);
}
