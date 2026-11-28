import { useMemo, useState } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { knowledgeIndexService } from '../../services/knowledgeIndex.ts';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import type { NoteMetadata } from '../../utils/metadataIndex.ts';
import { databaseRecord, downloadKnowledgeJson, noteDue, noteStatus, propertyText, useKnowledgeDocumentOpener, type KnowledgeViewProps } from './knowledgeModel.ts';
import { KnowledgeEmpty, KnowledgeError } from './KnowledgeStates.tsx';

export function DatabaseView({ onOpenDocument, onCreateNote }: KnowledgeViewProps) {
  const revision = useKnowledgeStore(state => state.revision);
  const activeRoot = useKnowledgeStore(state => state.activeRoot);
  const favorites = useKnowledgeStore(state => state.favorites);
  const toggleFavorite = useKnowledgeStore(state => state.toggleFavorite);
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [mode, setMode] = useState<'table' | 'board'>('table');
  const { openDocument, error } = useKnowledgeDocumentOpener(onOpenDocument);
  const allNotes = useMemo(() => {
    void revision; void activeRoot;
    return knowledgeIndexService.all();
  }, [revision, activeRoot]);
  const notes = useMemo(() => allNotes.filter(note => {
    if (status === '未设置' ? propertyText(note.properties.status) : status && noteStatus(note) !== status) return false;
    if (tag && !note.tags.includes(tag)) return false;
    if (favoritesOnly && !favorites.includes(note.path)) return false;
    return true;
  }), [allNotes, status, tag, favoritesOnly, favorites]);
  const statuses = useMemo(() => [...new Set(allNotes.map(noteStatus))].sort(), [allNotes]);
  const tags = useMemo(() => [...new Set(allNotes.flatMap(note => note.tags))].sort(), [allNotes]);
  const groups = useMemo(() => {
    const result = new Map<string, NoteMetadata[]>();
    notes.forEach(note => result.set(noteStatus(note), [...(result.get(noteStatus(note)) || []), note]));
    return result;
  }, [notes]);
  const exportJson = () => downloadKnowledgeJson('knowledge-database.json', notes.map(databaseRecord));
  const favoriteButton = (note: NoteMetadata) => (
    <button type="button" className={`knowledge-favorite ${favorites.includes(note.path) ? 'is-favorite' : ''}`} aria-label={`${favorites.includes(note.path) ? '取消收藏' : '收藏'} ${note.title}`} aria-pressed={favorites.includes(note.path)} onClick={() => toggleFavorite(note.path)}>
      <AppIcon name="star" size={14} />
    </button>
  );

  return (
    <div className="knowledge-database">
      <div className="knowledge-toolbar">
        <select aria-label="按状态筛选" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          {statuses.map(item => <option value={item} key={item}>{item}</option>)}
        </select>
        <select aria-label="按标签筛选" value={tag} onChange={event => setTag(event.target.value)}>
          <option value="">全部标签</option>
          {tags.map(item => <option value={item} key={item}>#{item}</option>)}
        </select>
        <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><AppIcon name="star" size={14} />收藏</button>
        <div className="knowledge-segmented" aria-label="数据库显示方式">
          <button type="button" aria-pressed={mode === 'table'} onClick={() => setMode('table')}><AppIcon name="table" size={14} />表格</button>
          <button type="button" aria-pressed={mode === 'board'} onClick={() => setMode('board')}><AppIcon name="grid" size={14} />看板</button>
        </div>
        <button type="button" onClick={exportJson}><AppIcon name="download" size={14} />JSON</button>
        <button type="button" onClick={onCreateNote}><AppIcon name="filePlus" size={14} />新建</button>
      </div>
      <div className="knowledge-result-count">{notes.length} 篇笔记{favoritesOnly ? ' · 仅收藏' : ''}</div>
      {error && <KnowledgeError message={error} />}
      {!notes.length ? (
        <KnowledgeEmpty title={allNotes.length ? '没有匹配的笔记' : '知识库还是空的'} icon="database">
          <p>{allNotes.length ? '调整状态、标签或收藏筛选后再试。' : '创建第一篇笔记，或刷新已有文件夹。'}</p>
          {onCreateNote && <button type="button" onClick={onCreateNote}><AppIcon name="filePlus" size={15} />新建笔记</button>}
        </KnowledgeEmpty>
      ) : mode === 'table' ? (
        <div className="knowledge-table-wrap">
          <table className="knowledge-table">
            <thead><tr><th>标题</th><th>状态</th><th>标签</th><th>截止日期</th></tr></thead>
            <tbody>{notes.map(note => (
              <tr key={note.path}>
                <td>
                  <div className="knowledge-note-cell">
                    {favoriteButton(note)}
                    <div className="knowledge-note-main">
                      <button type="button" className="knowledge-link" onClick={() => void openDocument(note.path)}>{note.title}</button>
                      <small className="knowledge-note-meta">{noteStatus(note)} · {propertyText(note.tags)}{noteDue(note) ? ` · ${noteDue(note)}` : ''}</small>
                    </div>
                  </div>
                </td>
                <td><span className="knowledge-badge">{noteStatus(note)}</span></td>
                <td>{propertyText(note.tags)}</td>
                <td>{noteDue(note)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="knowledge-board">
          {[...groups].map(([group, items]) => (
            <section className="knowledge-board-column" key={group}>
              <h3>{group}<span>{items.length}</span></h3>
              {items.map(note => (
                <article className="knowledge-board-card" key={note.path}>
                  <div className="knowledge-note-cell">{favoriteButton(note)}<button type="button" className="knowledge-link" onClick={() => void openDocument(note.path)}>{note.title}</button></div>
                  <span>{propertyText(note.tags)}</span>
                  <small>{noteDue(note)}</small>
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
