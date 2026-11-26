import { buildProjectContext, normalizeWorkspaceRoot, resolveCurrentWorkspaceRoot, type ProjectContextFile } from './projectContext.ts';

export function withProjectContext<T extends { project_context?: string }>(
  settings: T,
  files: readonly ProjectContextFile[],
  requestText: string,
  budget = 12_000,
  selectedSkills: readonly string[] = [],
  contextRoot?: string,
  currentFile?: string | null,
): T & { project_context?: string } {
  let selectedFiles = files;
  if (contextRoot !== undefined || currentFile !== undefined) {
    const expectedRoot = resolveCurrentWorkspaceRoot(currentFile);
    selectedFiles = expectedRoot && contextRoot && normalizeWorkspaceRoot(expectedRoot) === normalizeWorkspaceRoot(contextRoot) ? files : [];
  }
  const context = buildProjectContext(selectedFiles, requestText, budget, selectedSkills).text;
  const next = { ...settings } as T & { project_context?: string };
  if (context) next.project_context = context;
  else delete next.project_context;
  return next;
}
