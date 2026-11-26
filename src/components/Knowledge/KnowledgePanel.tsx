import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import '../../styles/knowledge.css';
import { KnowledgeTabs } from './KnowledgeTabs.tsx';
import { KnowledgeEmpty, KnowledgeError, KnowledgeLoading } from './KnowledgeStates.tsx';
import { DatabaseView } from './DatabaseView.tsx';
import { TasksView } from './TasksView.tsx';
import { CalendarView } from './CalendarView.tsx';
import { GraphView } from './GraphView.tsx';
import { PropertiesView } from './PropertiesView.tsx';
import { MigrationView } from './MigrationView.tsx';
import type { KnowledgeViewProps } from './knowledgeModel.ts';

export interface KnowledgePanelProps {
  root?: string;
  style?: React.CSSProperties;
  onOpenDocument?: KnowledgeViewProps['onOpenDocument'];
}

export function KnowledgePanel({ root, style, onOpenDocument }: KnowledgePanelProps) {
  const roots = useKnowledgeStore(state => state.roots);
  const storedRoot = useKnowledgeStore(state => state.activeRoot);
  const activeTab = useKnowledgeStore(state => state.activeTab);
  const scanning = useKnowledgeStore(state => state.scanning);
  const error = useKnowledgeStore(state => state.error);
  const setRoot = useKnowledgeStore(state => state.setRoot);
  const scan = useKnowledgeStore(state => state.scan);
  const clearError = useKnowledgeStore(state => state.clearError);
  const [draftRoot, setDraftRoot] = useState(root || '');
  const initializedRoot = useRef<string | null>(null);
  const activeRoot = root?.trim() || storedRoot;

  useEffect(() => {
    const target = root?.trim() || storedRoot || roots[0] || '';
    if (!target || initializedRoot.current === target) return;
    initializedRoot.current = target;
    if (target !== storedRoot) void setRoot(target);
    else void scan(target);
  }, [root, storedRoot, roots, setRoot, scan]);

  const addRoot = (event: FormEvent) => {
    event.preventDefault();
    if (draftRoot.trim()) void setRoot(draftRoot);
  };
  const viewProps = { onOpenDocument };
  const view = activeTab === 'database' ? <DatabaseView {...viewProps} />
    : activeTab === 'tasks' ? <TasksView {...viewProps} />
      : activeTab === 'calendar' ? <CalendarView {...viewProps} />
        : activeTab === 'graph' ? <GraphView {...viewProps} />
          : activeTab === 'properties' ? <PropertiesView /> : <MigrationView />;

  return (
    <section className="knowledge-panel" style={style} aria-label="知识管理">
      <header className="knowledge-header">
        <div className="knowledge-title"><AppIcon name="notebook" size={17} /><strong>知识库</strong></div>
        <div className="knowledge-root-controls">
          {roots.length > 0 && (
            <select aria-label="知识库根目录" value={activeRoot} onChange={event => void setRoot(event.target.value)}>
              {[...new Set([...roots, activeRoot].filter(Boolean))].map(item => <option value={item} key={item}>{item}</option>)}
            </select>
          )}
          <button type="button" className="knowledge-icon-button" aria-label="刷新知识库" title="刷新知识库" disabled={!activeRoot || scanning} onClick={() => void scan()}>
            <AppIcon name="refresh" size={16} className={scanning ? 'knowledge-spin' : ''} />
          </button>
        </div>
      </header>
      <KnowledgeTabs />
      {scanning && <KnowledgeLoading />}
      {error && <KnowledgeError message={error} onDismiss={clearError} />}
      {!activeRoot ? (
        <KnowledgeEmpty title="选择知识库根目录">
          <p>从已有工作区选择，或输入本地文件夹路径。仅索引 Markdown 文档。</p>
          <form className="knowledge-root-form" onSubmit={addRoot}>
            <input aria-label="新增知识库根目录" placeholder="例如 C:/notes" value={draftRoot} onChange={event => setDraftRoot(event.target.value)} />
            <button type="submit" disabled={!draftRoot.trim()}><AppIcon name="plus" size={15} />添加</button>
          </form>
        </KnowledgeEmpty>
      ) : (
        <main className="knowledge-view" id={`knowledge-view-${activeTab}`} role="tabpanel" aria-labelledby={`knowledge-tab-${activeTab}`}>
          {view}
        </main>
      )}
    </section>
  );
}
