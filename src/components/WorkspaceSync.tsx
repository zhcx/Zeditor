import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore.ts';
import { knowledgeIndexService } from '../services/knowledgeIndex.ts';
import { localHistoryRecorder } from '../services/localHistoryRecorder.ts';
import { useProjectContextStore } from '../stores/projectContextStore.ts';
import { resolveCurrentWorkspaceRoot } from '../utils/projectContext.ts';

const timers = new Map<string, number>();

function publishKnowledgeUpdate(path: string): void {
  window.dispatchEvent(new CustomEvent('zeditor-knowledge-updated', { detail: { path } }));
}

/** 应用级只读同步：保存触发本地历史，Markdown 编辑防抖更新增量索引。 */
export function WorkspaceSync() {
  useEffect(() => {
    const known = new Map<string, { path: string | null; content: string }>();
    let loadedContextRoot: string | null = null;
    const sync = (state = useAppStore.getState()) => {
      void localHistoryRecorder.observe(state.tabs);
      const workspaceRoot = resolveCurrentWorkspaceRoot(state.currentFile);
      if (workspaceRoot !== loadedContextRoot) {
        loadedContextRoot = workspaceRoot;
        void useProjectContextStore.getState().load(workspaceRoot).catch(() => undefined);
      }
      const open = new Set(state.tabs.map(tab => tab.id));
      for (const [id, timer] of timers) {
        if (!open.has(id)) { window.clearTimeout(timer); timers.delete(id); known.delete(id); }
      }
      for (const tab of state.tabs) {
        if (!tab.path || !/\.md$/i.test(tab.path)) continue;
        const prior = known.get(tab.id);
        if (prior?.path && prior.path !== tab.path) {
          const pending = timers.get(tab.id);
          if (pending !== undefined) window.clearTimeout(pending);
          timers.delete(tab.id);
          if (tab.saveAsFromPath === prior.path) knowledgeIndexService.upsert(tab.path, tab.content);
          else knowledgeIndexService.rename(prior.path, tab.path, tab.content);
          publishKnowledgeUpdate(tab.path);
        } else if (!prior || prior.content !== tab.content || prior.path !== tab.path) {
          const pending = timers.get(tab.id);
          if (pending !== undefined) window.clearTimeout(pending);
          const update = () => {
            timers.delete(tab.id);
            const latest = useAppStore.getState().tabs.find(item => item.id === tab.id);
            if (!latest?.path) return;
            knowledgeIndexService.upsert(latest.path, latest.content);
            publishKnowledgeUpdate(latest.path);
          };
          if (!tab.modified) update();
          else timers.set(tab.id, window.setTimeout(update, 600));
        }
        known.set(tab.id, { path: tab.path, content: tab.content });
      }
    };
    sync();
    const unsubscribe = useAppStore.subscribe(sync);
    return () => {
      unsubscribe();
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);
  return null;
}
