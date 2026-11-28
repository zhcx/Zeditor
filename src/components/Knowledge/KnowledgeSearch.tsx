import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { knowledgeIndexService } from '../../services/knowledgeIndex.ts';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import { filterKnowledgeNotes } from '../../utils/knowledgeSearch.ts';
import { useKnowledgeDocumentOpener, type KnowledgeViewProps } from './knowledgeModel.ts';
import { KnowledgeEmpty, KnowledgeError } from './KnowledgeStates.tsx';

export function KnowledgeSearch({ onClose, onOpenDocument }: KnowledgeViewProps & { onClose: () => void }) {
  const revision = useKnowledgeStore(state => state.revision);
  const activeRoot = useKnowledgeStore(state => state.activeRoot);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openDocument, error } = useKnowledgeDocumentOpener(onOpenDocument);
  const results = useMemo(() => {
    void revision; void activeRoot;
    return filterKnowledgeNotes(knowledgeIndexService.all(), deferredQuery).slice(0, 80);
  }, [revision, activeRoot, deferredQuery]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <section className="knowledge-search" aria-label="搜索知识库">
      <header>
        <AppIcon name="search" size={16} />
        <input ref={inputRef} aria-label="搜索知识库内容" placeholder="搜索标题、正文、标签、属性…" value={query} onChange={event => setQuery(event.target.value)} />
        <button type="button" aria-label="关闭知识库搜索" onClick={onClose}><AppIcon name="close" size={15} /></button>
      </header>
      <div className="knowledge-search-results">
        {error && <KnowledgeError message={error} />}
        {!query.trim() ? <KnowledgeEmpty title="搜索整个知识库" icon="search">支持标题、正文、标签和 frontmatter 属性。</KnowledgeEmpty>
          : !results.length ? <KnowledgeEmpty title="没有匹配结果" icon="search">试试更短的关键词或标签。</KnowledgeEmpty>
            : results.map(note => (
              <button type="button" className="knowledge-search-result" key={note.path} onClick={() => void openDocument(note.path)}>
                <AppIcon name="fileText" size={16} />
                <span><strong>{note.title}</strong><small>{note.path}</small>{note.searchText && <em>{note.searchText.slice(0, 90)}</em>}</span>
              </button>
            ))}
      </div>
    </section>
  );
}
