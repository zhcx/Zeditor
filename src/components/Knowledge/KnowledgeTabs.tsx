import { AppIcon } from '../Icons/AppIcon.tsx';
import type { IconName } from '../Icons/iconGeometry.ts';
import { useKnowledgeStore, type KnowledgeTab } from '../../stores/knowledgeStore.ts';

const TABS: ReadonlyArray<{ id: KnowledgeTab; label: string; icon: IconName }> = [
  { id: 'database', label: '数据库', icon: 'database' },
  { id: 'tasks', label: '任务', icon: 'listTodo' },
  { id: 'calendar', label: '日历', icon: 'clock' },
  { id: 'graph', label: '关系图', icon: 'workflow' },
  { id: 'properties', label: '属性', icon: 'notebook' },
  { id: 'migration', label: '迁移', icon: 'package' },
];

export function KnowledgeTabs() {
  const activeTab = useKnowledgeStore(state => state.activeTab);
  const setActiveTab = useKnowledgeStore(state => state.setActiveTab);
  return (
    <nav className="knowledge-tabs" role="tablist" aria-label="知识管理视图">
      {TABS.map(tab => (
        <button
          type="button"
          role="tab"
          id={`knowledge-tab-${tab.id}`}
          aria-controls={`knowledge-view-${tab.id}`}
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? 'is-active' : ''}
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
        >
          <AppIcon name={tab.icon} size={15} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
