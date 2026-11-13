import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibraryStore, type TemplateItem } from '../../stores/libraryStore';
import { SNIPPET_TOKEN_HELP } from '../../utils/snippetExpansion';
import { createNoteFromTemplate } from '../../services/libraryActions';

interface TemplatesDialogProps {
  onClose: () => void;
}

interface FormState {
  name: string;
  description: string;
  content: string;
}

const EMPTY: FormState = { name: '', description: '', content: '' };

export function TemplatesDialog({ onClose }: TemplatesDialogProps) {
  const templates = useLibraryStore((s) => s.templates);
  const addTemplate = useLibraryStore((s) => s.addTemplate);
  const updateTemplate = useLibraryStore((s) => s.updateTemplate);
  const deleteTemplate = useLibraryStore((s) => s.deleteTemplate);

  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((item) =>
      item.name.toLowerCase().includes(q)
      || item.description.toLowerCase().includes(q)
      || item.content.toLowerCase().includes(q));
  }, [templates, query]);

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

  const startNew = () => { setEditingId('new'); setForm(EMPTY); setError(null); };
  const startEdit = (item: TemplateItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, description: item.description, content: item.content });
    setError(null);
  };

  const submit = () => {
    const name = form.name.trim();
    if (!name) { setError('请填写模板名称'); return; }
    if (editingId === 'new') addTemplate({ name, description: form.description.trim(), content: form.content });
    else if (editingId) updateTemplate(editingId, { name, description: form.description.trim(), content: form.content });
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  };

  const handleUse = (item: TemplateItem) => {
    createNoteFromTemplate(item);
    onClose();
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'zeditor-templates.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : [];
      let count = 0;
      for (const raw of list) {
        if (raw && typeof raw.content === 'string') {
          addTemplate({
            name: String(raw.name || '导入模板'),
            description: String(raw.description || ''),
            content: String(raw.content),
          });
          count += 1;
        }
      }
      if (!count) setError('没有可导入的模板');
    } catch {
      setError('导入失败：不是有效的 JSON 文件');
    }
  };

  return (
    <div className="library-modal-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="library-modal library-modal-templates" role="dialog" aria-modal="true" aria-label="模板管理">
        <header className="library-modal-header">
          <div>
            <h2>笔记模板</h2>
            <p className="library-modal-subtitle">新建文档时套用，支持日期与文档占位符</p>
          </div>
          <button type="button" className="library-icon-btn" aria-label="关闭" onClick={onClose}>✕</button>
        </header>

        {editingId ? (
          <div className="library-form">
            <label className="library-field">
              <span>名称</span>
              <input ref={nameRef} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：会议记录" />
            </label>
            <label className="library-field">
              <span>说明</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="可选，简要描述用途" />
            </label>
            <label className="library-field library-field-grow">
              <span>内容</span>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="输入模板正文（Markdown），可包含占位符" />
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
              <input className="library-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索模板…" />
              <div className="library-toolbar-actions">
                <button type="button" className="library-btn" onClick={() => fileInputRef.current?.click()}>导入</button>
                <button type="button" className="library-btn" onClick={exportJson} disabled={!templates.length}>导出</button>
                <button type="button" className="library-btn primary" onClick={startNew}>新建模板</button>
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
              {filtered.length === 0 && <p className="library-empty">没有匹配的模板</p>}
              {filtered.map((item) => (
                <div className="library-card" key={item.id}>
                  <div className="library-card-main">
                    <div className="library-card-title">{item.name}</div>
                    {item.description && <div className="library-card-desc">{item.description}</div>}
                    <pre className="library-card-preview">{item.content.slice(0, 240)}</pre>
                  </div>
                  <div className="library-card-actions">
                    <button type="button" className="library-btn primary" onClick={() => handleUse(item)}>使用</button>
                    <button type="button" className="library-btn" onClick={() => startEdit(item)}>编辑</button>
                    <button type="button" className="library-btn danger" onClick={() => deleteTemplate(item.id)}>删除</button>
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
