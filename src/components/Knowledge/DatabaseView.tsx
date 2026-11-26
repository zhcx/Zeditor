import { useMemo, useState } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { knowledgeIndexService } from '../../services/knowledgeIndex.ts';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import type { NoteMetadata } from '../../utils/metadataIndex.ts';
import { databaseRecord, downloadKnowledgeJson, noteDue, noteStatus, propertyText, useKnowledgeDocumentOpener, type KnowledgeViewProps } from './knowledgeModel.ts';
import { KnowledgeEmpty, KnowledgeError } from './KnowledgeStates.tsx';

export function DatabaseView({ onOpenDocument }: KnowledgeViewProps) {
  const revision = useKnowledgeStore(state => state.revision);
  const activeRoot = useKnowledgeStore(state => state.activeRoot);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<'table' | 'board'>('table');
  const { openDocument, error } = useKnowledgeDocumentOpener(onOpenDocument);
  const notes = useMemo(() => {
    void revision; void activeRoot; // Invalidate after incremental index mutations or root changes.
    const queried = knowledgeIndexService.query(status && status !== '未设置' ? { status } : {});
    return status === '未设置' ? queried.filter(note => !propertyText(note.properties.status)) : queried;
  }, [revision, activeRoot, status]);
  const statuses = useMemo(() => {
    void revision; void activeRoot;
    return [...new Set(knowledgeIndexService.all().map(noteStatus))].sort();
  }, [revision, activeRoot]);
  const groups = useMemo(() => {
    const result = new Map<string, NoteMetadata[]>();
    notes.forEach(note => result.set(noteStatus(note), [...(result.get(noteStatus(note)) || []), note]));
    return result;
  }, [notes]);
  const exportJson = () => downloadKnowledgeJson('knowledge-database.json', notes.map(databaseRecord));

  return (
    <div className="knowledge-database">
      <div className="knowledge-toolbar">
        <select aria-label="按状态筛选" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          {statuses.map(item => <option value={item} key={item}>{item}</option>)}
        </select>
        <div className="knowledge-segmented" aria-label="数据库显示方式">
          <button type="button" aria-pressed={mode === 'table'} onClick={() => setMode('table')}><AppIcon name="table" size={14} />表格</button>
          <button type="button" aria-pressed={mode === 'board'} onClick={() => setMode('board')}><AppIcon name="grid" size={14} />看板</button>
        </div>
        <button type="button" onClick={exportJson}><AppIcon name="download" size={14} />JSON</button>
      </div>
      {error && <KnowledgeError message={error} />}
      {!notes.length ? <KnowledgeEmpty title={status ? '没有匹配的文档' : '知识库为空'} icon="database">刷新扫描后，文档会出现在这里。</KnowledgeEmpty>
        : mode === 'table' ? (
          <div className="knowledge-table-wrap">
            <table className="knowledge-table">
              <thead><tr><th>标题</th><th>状态</th><th>标签</th><th>截止日期</th></tr></thead>
              <tbody>{notes.map(note => (
                <tr key={note.path}>
                  <td><button type="button" className="knowledge-link" onClick={() => void openDocument(note.path)}>{note.title}</button></td>
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
                  <button type="button" className="knowledge-board-card" key={note.path} onClick={() => void openDocument(note.path)}>
                    <strong>{note.title}</strong>
                    <span>{propertyText(note.tags)}</span>
                    <small>{noteDue(note)}</small>
                  </button>
                ))}
              </section>
            ))}
          </div>
        )}
    </div>
  );
}
