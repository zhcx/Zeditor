import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { useAppStore } from '../../stores/appStore.ts';
import { useReviewStore } from '../../stores/reviewStore.ts';

interface SelectionDraft {
  from: number;
  to: number;
  quote: string;
}

export function ReviewPanel({ style }: { style?: React.CSSProperties }) {
  const { currentFile, activeTabId, content } = useAppStore(useShallow(state => ({ currentFile: state.currentFile, activeTabId: state.activeTabId, content: state.content })));
  const comments = useReviewStore(state => state.comments[state.documentKey] ?? []);
  const [draft, setDraft] = useState<SelectionDraft | null>(null);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [showResolved, setShowResolved] = useState(true);

  useEffect(() => {
    useReviewStore.getState().setDocument(currentFile, activeTabId, content);
  }, [currentFile, activeTabId, content]);

  const beginAdd = useCallback(() => {
    const editor = useAppStore.getState().editorView;
    if (!editor) {
      setMessage('请先打开一个文档并选择要批注的文字。');
      return;
    }
    editor.flushPendingEdits?.();
    const selection = editor.getSelection();
    if (selection.empty) {
      setMessage('请先选择需要批注的正文。');
      return;
    }
    setDraft({ from: selection.from, to: selection.to, quote: editor.getText(selection.from, selection.to) });
    setBody('');
    setMessage('');
  }, []);

  useEffect(() => {
    window.addEventListener('zeditor-review-open-composer', beginAdd);
    return () => window.removeEventListener('zeditor-review-open-composer', beginAdd);
  }, [beginAdd]);

  const submit = () => {
    if (!draft || !body.trim()) return;
    const id = useReviewStore.getState().addComment(draft, draft.quote, body);
    if (!id) {
      setMessage('选区已变化，请重新选择批注文字。');
      return;
    }
    setDraft(null);
    setBody('');
    setMessage('批注已添加并保存在本机。');
  };

  const locate = (from: number, to: number) => {
    const editor = useAppStore.getState().editorView;
    if (!editor) return;
    editor.setSelection(from, to);
    editor.revealOffset(from);
    editor.focus();
  };

  const exportJSON = () => {
    const blob = new Blob([useReviewStore.getState().exportComments()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const name = currentFile?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || activeTabId || 'document';
    anchor.href = url;
    anchor.download = `${name}-review.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const visibleComments = comments.filter(comment => showResolved || !comment.resolved);

  return (
    <aside className="sidebar review-panel" style={style} aria-label="审阅">
      <div className="sidebar-surface">
        <header className="vscode-explorer-header">
          <span>审阅</span>
          <div className="vscode-explorer-actions">
            <button onClick={beginAdd} title="为当前选区添加批注" aria-label="添加批注"><AppIcon name="comment" size={16} /></button>
            <button onClick={exportJSON} title="导出批注 JSON" aria-label="导出批注 JSON"><AppIcon name="download" size={16} /></button>
          </div>
        </header>

        <div className="review-panel-content">
          <button className="review-add-button" onClick={beginAdd}><AppIcon name="plus" size={15} />为选区添加批注</button>
          <label className="review-filter"><input type="checkbox" checked={showResolved} onChange={event => setShowResolved(event.target.checked)} />显示已解决</label>
          {message && <p className="review-message" role="status">{message}</p>}
          {draft && (
            <section className="review-composer" aria-label="添加批注">
              <blockquote>{draft.quote}</blockquote>
              <textarea autoFocus value={body} onChange={event => setBody(event.target.value)} placeholder="输入批注内容" rows={3} />
              <div><button onClick={() => setDraft(null)}>取消</button><button className="primary" disabled={!body.trim()} onClick={submit}>添加批注</button></div>
            </section>
          )}
          <div className="review-list" aria-label="批注列表">
            {visibleComments.length ? visibleComments.map(comment => (
              <article key={comment.id} className={`review-comment ${comment.resolved ? 'resolved' : ''} ${comment.stale ? 'stale' : ''}`}>
                <header><strong>{comment.author}</strong><time>{new Date(comment.createdAt).toLocaleString()}</time></header>
                <blockquote>{comment.quote}</blockquote>
                <p>{comment.body}</p>
                {comment.stale && <small className="review-stale-label">原文已变化，保留原锚点，不自动重定位</small>}
                <footer>
                  <button disabled={comment.stale} onClick={() => locate(comment.from, comment.to)}>定位</button>
                  <button onClick={() => useReviewStore.getState().setResolved(comment.id, !comment.resolved)}>{comment.resolved ? '重新打开' : '解决'}</button>
                  <button className="danger" onClick={() => useReviewStore.getState().deleteComment(comment.id)}>删除</button>
                </footer>
              </article>
            )) : <div className="review-empty">选择正文后添加第一条批注</div>}
          </div>
        </div>
      </div>
    </aside>
  );
}
