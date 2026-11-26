export interface EditorDocumentIdentityState {
  activeTabId: string | null;
  content: string;
  tabs: ReadonlyArray<{ id: string; content: string }>;
}

/** A controller may write only while both its tab and document snapshot are current. */
export function isActiveEditorDocument(
  tabId: string | null | undefined,
  source: string,
  state: EditorDocumentIdentityState,
): boolean {
  if (!tabId || tabId !== state.activeTabId) return false;
  const tab = state.tabs.find(item => item.id === tabId);
  return Boolean(tab && tab.content === source && state.content === source);
}
