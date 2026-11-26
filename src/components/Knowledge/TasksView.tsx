import { useMemo, useState } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { knowledgeIndexService } from '../../services/knowledgeIndex.ts';
import { toggleMarkdownTask } from '../../services/knowledgeActions.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import { useKnowledgeDocumentOpener, type KnowledgeViewProps } from './knowledgeModel.ts';
import { KnowledgeEmpty, KnowledgeError } from './KnowledgeStates.tsx';

export function TasksView({ onOpenDocument }: KnowledgeViewProps) {
  const revision = useKnowledgeStore(state => state.revision);
  const activeRoot = useKnowledgeStore(state => state.activeRoot);
  const [done, setDone] = useState<'all' | 'open' | 'done'>('all');
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const { openDocument, error } = useKnowledgeDocumentOpener(onOpenDocument);
  const tasks = useMemo(() => {
    void revision; void activeRoot;
    return knowledgeIndexService.tasks({
    done: done === 'all' ? undefined : done === 'done',
    tag: tag || undefined,
  });
  }, [revision, activeRoot, done, tag]);
  const tags = useMemo(() => {
    void revision; void activeRoot;
    return [...new Set(knowledgeIndexService.tasks().flatMap(task => task.tags))].sort();
  }, [revision, activeRoot]);

  const toggle = async (task: typeof tasks[number]) => {
    const key = `${task.path}:${task.line}`;
    setBusy(key); setActionError(null);
    try {
      const openTab = useAppStore.getState().tabs.find(tab => tab.path === task.path);
      if (openTab?.modified) throw new Error('来源文档有未保存修改，请先保存后再切换任务。');
      const result = await toggleMarkdownTask(task.path, task.line, !task.done);
      useKnowledgeStore.getState().upsertCurrentContent(task.path, result.content);
      const app = useAppStore.getState();
      if (app.currentFile === task.path) app.updateTabContent(app.activeTabId!, result.content, 'external');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : String(reason));
    } finally { setBusy(''); }
  };

  return (
    <div className="knowledge-tasks">
      <div className="knowledge-toolbar">
        <select aria-label="按完成状态筛选任务" value={done} onChange={event => setDone(event.target.value as typeof done)}>
          <option value="all">全部任务</option><option value="open">未完成</option><option value="done">已完成</option>
        </select>
        <select aria-label="按标签筛选任务" value={tag} onChange={event => setTag(event.target.value)}>
          <option value="">全部标签</option>{tags.map(item => <option value={item} key={item}>#{item}</option>)}
        </select>
      </div>
      <p className="knowledge-hint">勾选会检查磁盘版本后切换任务；来源链接仅定位文档。</p>
      {error && <KnowledgeError message={error} />}
      {actionError && <KnowledgeError message={actionError} />}
      {!tasks.length ? <KnowledgeEmpty title="没有匹配的任务" icon="listTodo" />
        : <ul className="knowledge-task-list">{tasks.map((task, index) => (
          <li className={task.done ? 'is-done' : ''} key={`${task.path}:${task.line}:${index}`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={task.done}
              aria-label={`${task.done ? '已完成' : '完成'}：${task.text}`}
              disabled={Boolean(busy)}
              onClick={() => void toggle(task)}
            ><AppIcon name={task.done ? 'check' : 'listTodo'} size={16} /></button>
            <div className="knowledge-task-body">
              <span>{task.text}</span>
              <div className="knowledge-task-meta">
                {task.due && <time>{task.due}</time>}
                {task.tags.map(item => <span key={item}>#{item}</span>)}
                <button type="button" className="knowledge-link" onClick={() => void openDocument(task.path)}>{task.path}:{task.line}</button>
              </div>
            </div>
          </li>
        ))}</ul>}
    </div>
  );
}
