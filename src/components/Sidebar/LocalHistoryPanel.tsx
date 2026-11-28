import { useCallback, useEffect, useMemo, useState } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { useAppStore } from '../../stores/appStore.ts';
import { documentIdForPath, localHistoryService, type LocalHistoryEntry } from '../../services/localHistory.ts';
import '../../styles/localHistory.css';

export function LocalHistoryPanel({ style }: { style?: React.CSSProperties }) {
  const currentFile = useAppStore(state => state.currentFile);
  const activeTabId = useAppStore(state => state.activeTabId);
  const tabs = useAppStore(state => state.tabs);
  const updateTabContent = useAppStore(state => state.updateTabContent);
  const tab = tabs.find(item => item.id === activeTabId);
  const documentId = useMemo(() => currentFile ? documentIdForPath(currentFile) : null, [currentFile]);
  const [entries, setEntries] = useState<LocalHistoryEntry[]>([]);
  const [preview, setPreview] = useState<{ entry: LocalHistoryEntry; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const previewRef = useModalFocus<HTMLDivElement>(Boolean(preview), () => setPreview(null));

  const load = useCallback(async () => {
    if (!documentId) { setEntries([]); return; }
    setLoading(true);
    try { setEntries(await localHistoryService.list(documentId)); }
    catch (error) { setMessage(`读取历史失败：${String(error)}`); }
    finally { setLoading(false); }
  }, [documentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, tab?.fileVersion?.sha256]);

  const showPreview = async (entry: LocalHistoryEntry) => {
    if (!documentId) return;
    try {
      const result = await localHistoryService.read(documentId, entry.versionId);
      setPreview({ entry: result.entry, content: result.content });
    } catch (error) { setMessage(`预览失败：${String(error)}`); }
  };

  const restore = async () => {
    if (!preview || !tab) return;
    const latest = useAppStore.getState().tabs.find(item => item.id === tab.id);
    if (!latest || latest.path !== currentFile) { setMessage('文档已切换，请重新选择历史版本。'); return; }
    updateTabContent(tab.id, preview.content, 'external');
    setMessage('历史内容已载入编辑器并标记为修改；请审阅后手动保存，不会直接覆盖磁盘。');
    setPreview(null);
    await load();
  };

  const remove = async (entry: LocalHistoryEntry) => {
    if (!documentId || !window.confirm('确定删除这个本地历史版本？')) return;
    try { await localHistoryService.remove(documentId, entry.versionId); await load(); }
    catch (error) { setMessage(`删除失败：${String(error)}`); }
  };

  const snapshot = async () => {
    if (!documentId || !tab?.path) return;
    const label = window.prompt('版本说明', '手动版本')?.trim();
    if (!label) return;
    try {
      await localHistoryService.record(documentId, tab.path, tab.content, tab.encoding || 'utf-8', label);
      setMessage('已创建本地版本。');
      await load();
    } catch (error) { setMessage(`创建失败：${String(error)}`); }
  };

  return (
    <section className="sidebar local-history-panel" style={style} aria-label="本地版本历史">
      <header className="local-history-header">
        <div><AppIcon name="history" size={16} /><strong>本地版本</strong></div>
        <button type="button" onClick={() => void load()} disabled={loading} title="刷新"><AppIcon name="refresh" size={14} /></button>
        <button type="button" onClick={() => void snapshot()} disabled={!tab?.path}>建立版本</button>
      </header>
      {message && <p className="local-history-message" role="status">{message}</p>}
      {!currentFile && <p className="local-history-empty">保存文档后可查看本地版本。</p>}
      {currentFile && !entries.length && !loading && <p className="local-history-empty">暂无本地版本。保存或建立版本后会显示在这里。</p>}
      <div className="local-history-list">
        {entries.map(entry => (
          <article key={entry.versionId} className="local-history-entry">
            <div><strong>{entry.label}</strong><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time></div>
            <small>{Math.max(1, Math.ceil(entry.size / 1024))} KiB · {entry.path}</small>
            <footer>
              <button type="button" onClick={() => void showPreview(entry)}>预览</button>
              <button type="button" onClick={() => void remove(entry)}>删除</button>
            </footer>
          </article>
        ))}
      </div>
      {preview && (
        <div ref={previewRef} className="local-history-preview" role="dialog" aria-modal="true" aria-label="历史版本预览">
          <header><strong>{preview.entry.label}</strong><button data-autofocus type="button" onClick={() => setPreview(null)} aria-label="关闭预览">×</button></header>
          <pre>{preview.content}</pre>
          <footer><button type="button" onClick={() => setPreview(null)}>取消</button><button type="button" className="primary" onClick={() => void restore()}>载入编辑器</button></footer>
        </div>
      )}
    </section>
  );
}
