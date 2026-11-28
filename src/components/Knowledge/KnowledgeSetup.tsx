import { useState, type FormEvent } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { AppIcon } from '../Icons/AppIcon.tsx';

export function KnowledgeSetup({ roots, onSelect, busy }: {
  roots: readonly string[];
  onSelect: (root: string) => void;
  busy?: boolean;
}) {
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const chooseFolder = async () => {
    setError('');
    try {
      const selected = await open({ directory: true, multiple: false });
      const root = Array.isArray(selected) ? selected[0] : selected;
      if (root) onSelect(root);
    } catch {
      setError('无法打开文件夹选择器，请在下方手动输入路径。');
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!manual.trim()) return;
    setError('');
    onSelect(manual.trim());
  };

  return (
    <div className="knowledge-setup">
      <div className="knowledge-setup-hero">
        <span className="knowledge-setup-icon"><AppIcon name="notebook" size={26} /></span>
        <h2>连接你的知识库</h2>
        <p>选择一个包含 Markdown 的文件夹，统一管理笔记、任务、日历和关系。</p>
      </div>
      <button type="button" className="knowledge-primary-button" aria-label="选择知识库文件夹" disabled={busy} onClick={() => void chooseFolder()}>
        <AppIcon name="folderOpen" size={16} />选择知识库文件夹
      </button>
      {error && <p className="knowledge-setup-error" role="alert">{error}</p>}
      {roots.length > 0 && (
        <section className="knowledge-recent-roots" aria-label="最近知识库">
          <h3>最近使用</h3>
          {roots.map(root => (
            <button type="button" key={root} onClick={() => onSelect(root)} disabled={busy}>
              <AppIcon name="folder" size={15} /><span>{root}</span>
            </button>
          ))}
        </section>
      )}
      <form className="knowledge-root-form knowledge-manual-root" onSubmit={submit}>
        <input aria-label="手动输入知识库路径" placeholder="或手动输入，例如 C:/notes" value={manual} onChange={event => setManual(event.target.value)} />
        <button type="submit" disabled={!manual.trim() || busy}>连接</button>
      </form>
      <div className="knowledge-setup-features" aria-label="知识库功能">
        <span><AppIcon name="database" size={14} />数据库</span>
        <span><AppIcon name="listTodo" size={14} />任务</span>
        <span><AppIcon name="clock" size={14} />日历</span>
        <span><AppIcon name="workflow" size={14} />关系图</span>
      </div>
      <p className="knowledge-setup-note">仅索引 Markdown 与 frontmatter，不会修改原文件。</p>
    </div>
  );
}
