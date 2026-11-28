import { useMemo } from 'react';
import { knowledgeIndexService } from '../../services/knowledgeIndex.ts';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';

export function KnowledgeSummary() {
  const revision = useKnowledgeStore(state => state.revision);
  const activeRoot = useKnowledgeStore(state => state.activeRoot);
  const favorites = useKnowledgeStore(state => state.favorites);
  const stats = useMemo(() => {
    void revision; void activeRoot;
    const notes = knowledgeIndexService.all();
    return {
      notes: notes.length,
      tasks: knowledgeIndexService.tasks({ done: false }).length,
      tags: new Set(notes.flatMap(note => note.tags)).size,
      favorites: favorites.filter(path => notes.some(note => note.path === path)).length,
    };
  }, [revision, activeRoot, favorites]);

  return (
    <div className="knowledge-summary" aria-label="知识库概览">
      <div><strong>{stats.notes}</strong><span>笔记</span></div>
      <div><strong>{stats.tasks}</strong><span>待办</span></div>
      <div><strong>{stats.tags}</strong><span>标签</span></div>
      <div><strong>{stats.favorites}</strong><span>收藏</span></div>
    </div>
  );
}
