import { useMemo, useState } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { knowledgeIndexService } from '../../services/knowledgeIndex.ts';
import { createDailyNote } from '../../services/knowledgeActions.ts';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import { currentMonth, groupByDate, shiftMonth, useKnowledgeDocumentOpener, type KnowledgeViewProps } from './knowledgeModel.ts';
import { KnowledgeEmpty, KnowledgeError } from './KnowledgeStates.tsx';

export function CalendarView({ onOpenDocument }: KnowledgeViewProps) {
  const revision = useKnowledgeStore(state => state.revision);
  const activeRoot = useKnowledgeStore(state => state.activeRoot);
  const [month, setMonth] = useState(currentMonth);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { openDocument, error } = useKnowledgeDocumentOpener(onOpenDocument);
  const entries = useMemo(() => {
    void revision; void activeRoot;
    return knowledgeIndexService.calendar(month);
  }, [revision, activeRoot, month]);
  const groups = useMemo(() => groupByDate(entries, entry => entry.date), [entries]);

  const createToday = async () => {
    if (!activeRoot) { setCreateError('请先选择知识库根目录'); return; }
    setCreating(true); setCreateError(null);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const result = await createDailyNote(activeRoot, date);
      setMonth(date.slice(0, 7));
      await openDocument(result.path);
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : String(reason));
    } finally { setCreating(false); }
  };

  return (
    <div className="knowledge-calendar">
      <div className="knowledge-toolbar">
        <button type="button" aria-label="上个月" onClick={() => setMonth(value => shiftMonth(value, -1))}><AppIcon name="chevronLeft" size={15} /></button>
        <input aria-label="日历月份" type="month" value={month} onChange={event => event.target.value && setMonth(event.target.value)} />
        <button type="button" aria-label="下个月" onClick={() => setMonth(value => shiftMonth(value, 1))}><AppIcon name="chevronRight" size={15} /></button>
        <button type="button" disabled={creating || !activeRoot} onClick={() => void createToday()}><AppIcon name="plus" size={15} />新建今日日记</button>
      </div>
      {error && <KnowledgeError message={error} />}
      {createError && <KnowledgeError message={createError} />}
      {!entries.length ? <KnowledgeEmpty title="本月没有日期条目" icon="clock">文档 due/date 与任务截止日期会显示在这里。</KnowledgeEmpty>
        : <div className="knowledge-calendar-groups">{[...groups].map(([date, items]) => (
          <section key={date}>
            <h3><time>{date}</time><span>{items.length}</span></h3>
            {items.map((entry, index) => (
              <button type="button" className="knowledge-calendar-entry" key={`${entry.note.path}:${index}`} onClick={() => void openDocument(entry.note.path)}>
                <AppIcon name={entry.task ? 'listTodo' : 'fileText'} size={15} />
                <span><strong>{entry.task?.text || entry.note.title}</strong><small>{entry.note.path}</small></span>
              </button>
            ))}
          </section>
        ))}</div>}
    </div>
  );
}
