import { useState, type FormEvent } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { createKnowledgeNote } from '../../services/knowledgeActions.ts';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import { useKnowledgeDocumentOpener, type KnowledgeViewProps } from './knowledgeModel.ts';
import { KnowledgeError } from './KnowledgeStates.tsx';

export function KnowledgeQuickNote({ onCancel, onOpenDocument }: KnowledgeViewProps & { onCancel: () => void }) {
  const activeRoot = useKnowledgeStore(state => state.activeRoot);
  const scan = useKnowledgeStore(state => state.scan);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { openDocument } = useKnowledgeDocumentOpener(onOpenDocument);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !activeRoot || busy) return;
    setBusy(true); setError('');
    try {
      const result = await createKnowledgeNote(activeRoot, title);
      await scan(activeRoot);
      onCancel();
      await openDocument(result.path);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setBusy(false); }
  };
  return (
    <form className="knowledge-quick-note" onSubmit={event => void submit(event)}>
      <AppIcon name="filePlus" size={17} />
      <input autoFocus aria-label="新笔记标题" placeholder="新笔记标题" value={title} onChange={event => setTitle(event.target.value)} />
      <button type="submit" disabled={!title.trim() || busy}>{busy ? '创建中…' : '创建'}</button>
      <button type="button" onClick={onCancel} disabled={busy}>取消</button>
      {error && <KnowledgeError message={error} />}
    </form>
  );
}
