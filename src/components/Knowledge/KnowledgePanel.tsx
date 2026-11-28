import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import '../../styles/knowledge.css';
import { KnowledgeTabs } from './KnowledgeTabs.tsx';
import { KnowledgeError, KnowledgeLoading } from './KnowledgeStates.tsx';
import { KnowledgeSetup } from './KnowledgeSetup.tsx';
import { KnowledgeSummary } from './KnowledgeSummary.tsx';
import { KnowledgeSearch } from './KnowledgeSearch.tsx';
import { KnowledgeQuickNote } from './KnowledgeQuickNote.tsx';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const initializedRoot = useRef<string | null>(null);
  const activeRoot = root?.trim() || storedRoot;

  useEffect(() => {
    const target = root?.trim() || storedRoot || roots[0] || '';
    if (!target || initializedRoot.current === target) return;
    initializedRoot.current = target;
    if (target !== storedRoot) void setRoot(target);
    else void scan(target);
  }, [root, storedRoot, roots, setRoot, scan]);

  const viewProps = { onOpenDocument, onCreateNote: () => setQuickNoteOpen(true) };
  const view = activeTab === 'database' ? <DatabaseView {...viewProps} />
    : activeTab === 'tasks' ? <TasksView {...viewProps} />
      : activeTab === 'calendar' ? <CalendarView {...viewProps} />
        : activeTab === 'graph' ? <GraphView {...viewProps} />
          : activeTab === 'properties' ? <PropertiesView /> : <MigrationView />;

  return (
    <section className="knowledge-panel" style={style} aria-label="知识管理">
      <header className="knowledge-header">
        <div className="knowledge-title"><AppIcon name="notebook" size={17} /><strong>知识库</strong></div>
        <div className="knowledge-actions">
          <button type="button" className={`knowledge-icon-button ${searchOpen ? 'is-active' : ''}`} aria-label="搜索知识库" title="搜索知识库" aria-pressed={searchOpen} disabled={!activeRoot} onClick={() => { setSearchOpen(open => !open); setQuickNoteOpen(false); }}><AppIcon name="search" size={16} /></button>
          <button type="button" className={`knowledge-icon-button ${quickNoteOpen ? 'is-active' : ''}`} aria-label="新建笔记" title="新建笔记" aria-pressed={quickNoteOpen} disabled={!activeRoot} onClick={() => { setQuickNoteOpen(open => !open); setSearchOpen(false); }}><AppIcon name="filePlus" size={16} /></button>
          <button type="button" className="knowledge-icon-button" aria-label="刷新知识库" title="刷新知识库" disabled={!activeRoot || scanning} onClick={() => void scan()}><AppIcon name="refresh" size={16} className={scanning ? 'knowledge-spin' : ''} /></button>
        </div>
      </header>

      {!activeRoot ? (
        <KnowledgeSetup roots={roots} onSelect={path => void setRoot(path)} busy={scanning} />
      ) : (
        <>
          <div className="knowledge-root-bar">
            <AppIcon name="folder" size={14} />
            <select aria-label="知识库根目录" value={activeRoot} onChange={event => void setRoot(event.target.value)}>
              {[...new Set([...roots, activeRoot].filter(Boolean))].map(item => <option value={item} key={item}>{item}</option>)}
            </select>
          </div>
          {!searchOpen && <><KnowledgeSummary /><KnowledgeTabs /></>}
          {scanning && <KnowledgeLoading />}
          {error && <KnowledgeError message={error} onDismiss={clearError} />}
          {searchOpen
            ? <KnowledgeSearch onClose={() => setSearchOpen(false)} onOpenDocument={onOpenDocument} />
            : <>
              {quickNoteOpen && <KnowledgeQuickNote onCancel={() => setQuickNoteOpen(false)} onOpenDocument={onOpenDocument} />}
              <main className="knowledge-view" id={`knowledge-view-${activeTab}`} role="tabpanel" aria-labelledby={`knowledge-tab-${activeTab}`}>
                {view}
              </main>
            </>}
        </>
      )}
    </section>
  );
}
