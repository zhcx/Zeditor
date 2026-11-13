import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibraryStore, type SnippetItem } from '../../stores/libraryStore';
import { SNIPPET_TOKEN_HELP } from '../../utils/snippetExpansion';
import { insertSnippet } from '../../services/libraryActions';

interface SnippetsDialogProps {
  onClose: () => void;
}

interface FormState {
  name: string;
  description: string;
  template: string;
}

const EMPTY: FormState = { name: '', description: '', template: '' };

export function SnippetsDialog({ onClose }: SnippetsDialogProps) {
  const snippets = useLibraryStore((s) => s.snippets);
  const addSnippet = useLibraryStore((s) => s.addSnippet);
  const updateSnippet = useLibraryStore((s) => s.updateSnippet);
  const deleteSnippet = useLibraryStore((s) => s.deleteSnippet);

  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return snippets;
    return snippets.filter((item) =>
      item.name.toLowerCase().includes(q)
      || item.description.toLowerCase().includes(q)
      || item.template.toLowerCase().includes(q));
  }, [snippets, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editingId) setEditingId(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId, onClose]);

  useEffect(() => {
    if (editingId) nameRef.current?.focus();
  }, [editingId]);

  const startNew = () => {
    setEditingId('new');
    setForm(EMPTY);
    setError(null);
  };

  const startEdit = (item: SnippetItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, description: item.description, template: item.template });
    setError(null);
  };

  const submit = () => {
    const name = form.name.trim();
    if (!name) { setError('请填写片段名称'); return; }
    if (!form.template.trim()) { setError('请填写片段内容'); return; }
    if (editingId === 'new') addSnippet({ name, description: form.description.trim(), template: form.template });
    else if (editingId) updateSnippet(editingId, { name, description: form.description.trim(), template: form.template });
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  };

  const handleInsert = (item: SnippetItem) => {
    insertSnippet(item);
    onClose();
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(snippets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'zeditor-snippets.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : [];
      let count = 0;
      for (const raw of list) {
        if (raw && typeof raw.template === 'string' && raw.template.trim()) {
          addSnippet({
            name: String(raw.name || '导入片段'),
            description: String(raw.description || ''),
            template: String(raw.template),
          });
          count += 1;
        }
      }
      if (!count) setError('没有可导入的片段');
    } catch {
      setError('导入失败：不是有效的 JSON 文件');
    }
  };

  return (
    <div className="library-modal-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="library-modal library-modal-snippets" role="dialog" aria-modal="true" aria-label="片段管理">
        <header className="library-modal-header">
          <div>
            <h2>片段</h2>
            <p className="library-modal-subtitle">常用文本一键插入，支持日期与文档占位符</p>
          </div>
          <button type="button" className="library-icon-btn" aria-label="关闭" onClick={onClose}>✕</button>
        </header>

        {editingId ? (
          <div className="library-form">
            <label className="library-field">
              <span>名称</span>
              <input ref={nameRef} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：今日日期" />
            </label>
            <label className="library-field">
              <span>说明</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="可选，简要描述用途" />
            </label>
            <label className="library-field library-field-grow">
              <span>内容</span>
              <textarea value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} placeholder="输入要插入的文本，可包含占位符" />
            </label>
            <p className="library-token-help">{SNIPPET_TOKEN_HELP}</p>
            {error && <p className="library-error">{error}</p>}
            <div className="library-form-actions">
              <button type="button" className="library-btn" onClick={() => { setEditingId(null); setError(null); }}>取消</button>
              <button type="button" className="library-btn primary" onClick={submit}>保存</button>
            </div>
          </div>
        ) : (
          <>
            <div className="library-toolbar">
              <input className="library-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索片段…" />
              <div className="library-toolbar-actions">
                <button type="button" className="library-btn" onClick={() => fileInputRef.current?.click()}>导入</button>
                <button type="button" className="library-btn" onClick={exportJson} disabled={!snippets.length}>导出</button>
                <button type="button" className="library-btn primary" onClick={startNew}>新建片段</button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importJson(file);
                  e.target.value = '';
                }}
              />
            </div>
            {error && <p className="library-error">{error}</p>}
            <div className="library-list">
              {filtered.length === 0 && <p className="library-empty">没有匹配的片段</p>}
              {filtered.map((item) => (
                <div className="library-card" key={item.id}>
                  <div className="library-card-main">
                    <div className="library-card-title">{item.name}</div>
                    {item.description && <div className="library-card-desc">{item.description}</div>}
                    <pre className="library-card-preview">{item.template}</pre>
                  </div>
                  <div className="library-card-actions">
                    <button type="button" className="library-btn primary" onClick={() => handleInsert(item)}>插入</button>
                    <button type="button" className="library-btn" onClick={() => startEdit(item)}>编辑</button>
                    <button type="button" className="library-btn danger" onClick={() => deleteSnippet(item.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
