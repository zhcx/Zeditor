import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../Icons/AppIcon';
import { useProjectContextStore, type NewProjectContextKind } from '../../stores/projectContextStore';
import { readStoredStringArray } from '../../utils/storage';
import { buildProjectContext, type ProjectContextFile } from '../../utils/projectContext';
import './ProjectContextPanel.css';

const KIND_LABELS = { instructions: '写作要求', style: '文风', library: '资料', skill: '技能', memory: '记忆' };
const NEW_BUTTONS: Array<{ kind: NewProjectContextKind; label: string }> = [
  { kind: 'style', label: '新建文风' }, { kind: 'instructions', label: '新建写作要求' },
  { kind: 'library', label: '新建资料条目' }, { kind: 'skill', label: '新建技能' },
];

function FileSummary({ file }: { file: ProjectContextFile }) {
  return <span className="project-context-file-summary"><span>{file.scope === 'project' ? '项目' : '全局'} · {KIND_LABELS[file.kind]}</span><strong>{file.title}</strong></span>;
}

export function ProjectContextPanel() {
  const { files, loading, error, root: loadedRoot, budget, selectedSkills, load, save, createDefault, setBudget, setSelectedSkills } = useProjectContextStore();
  const [root, setRoot] = useState(() => readStoredStringArray('zeditor.workspace-roots')[0] || '');
  const roots = useMemo(() => readStoredStringArray('zeditor.workspace-roots'), []);
  const [activePath, setActivePath] = useState('');
  const [edit, setEdit] = useState<{ path: string; base: string; value: string } | null>(null);
  const [requestText, setRequestText] = useState('请根据项目上下文续写当前文档。');
  const selectedPath = files.some(file => file.path === activePath) ? activePath : files[0]?.path || '';
  const selected = files.find(file => file.path === selectedPath);
  const draft = edit && edit.path === selected?.path && edit.base === selected.content ? edit.value : selected?.content || '';
  const preview = useMemo(() => buildProjectContext(files, requestText, budget, selectedSkills), [files, requestText, budget, selectedSkills]);

  useEffect(() => { if (root && root !== loadedRoot) void load(root).catch(() => undefined); }, [root, loadedRoot, load]);
  const create = (kind: NewProjectContextKind) => { void createDefault(kind).then(file => setActivePath(file.path)).catch(() => undefined); };

  return <section className="project-context-panel" aria-labelledby="project-context-title">
    <header className="project-context-header">
      <div><h3 id="project-context-title">项目 AI 配置</h3><p>本地 Markdown 为唯一事实来源，预览与最终请求使用同一构建规则。</p></div>
      <span className="project-context-badge">设为当前请求上下文 · 自动预览</span>
    </header>
    <div className="project-context-toolbar">
      <label className="project-context-root"><span>工作区根目录</span><select className="input" value={root} onChange={event => setRoot(event.target.value)} disabled={!roots.length}>
        {!roots.length && <option value="">未配置工作区</option>}{roots.map(item => <option key={item} value={item}>{item}</option>)}
      </select></label>
      <button type="button" className="button" disabled={!root || loading} onClick={() => void load(root).catch(() => undefined)}><AppIcon name="refresh" size={15} />刷新</button>
    </div>
    <div className="project-context-new">{NEW_BUTTONS.map(item => <button type="button" className="button" key={item.kind} disabled={!loadedRoot || loading} onClick={() => create(item.kind)}><AppIcon name="plus" size={14} />{item.label}</button>)}</div>
    {error && <p className="project-context-error" role="alert">{error}</p>}
    <div className="project-context-workspace">
      <aside className="project-context-files" aria-label="上下文文件列表">
        <div className="project-context-list-heading">文件 <span>{files.length}</span></div>
        {files.map(file => <button type="button" className={`button project-context-file ${file.path === selectedPath ? 'is-selected' : ''}`} key={file.path} onClick={() => { setActivePath(file.path); setEdit(null); }}><FileSummary file={file} /></button>)}
        {!files.length && <p className="project-context-empty">{loading ? '正在读取本地 Markdown…' : '暂无上下文文件，可从上方新建。'}</p>}
      </aside>
      <div className="project-context-editor">
        {selected ? <>
          <div className="project-context-editor-heading"><div><strong>{selected.title}</strong><span>{selected.scope === 'project' ? '项目' : '全局'} · {KIND_LABELS[selected.kind]}</span></div><button type="button" className="button project-context-save" disabled={loading} onClick={() => void save(selected.path, draft).then(() => setEdit(null)).catch(() => undefined)}><AppIcon name="save" size={15} />保存</button></div>
          <p className="project-context-path">本地 Markdown 路径：<code>{selected.path}</code></p>
          <textarea className="input project-context-textarea" aria-label={`编辑 ${selected.title}`} value={draft} onChange={event => setEdit({ path: selected.path, base: selected.content, value: event.target.value })} spellCheck={false} />
        </> : <p className="project-context-empty">选择文件后可编辑其 Markdown 内容。</p>}
      </div>
    </div>
    <div className="project-context-preview-settings">
      <label><span>当前请求（用于预览匹配）</span><textarea className="input" value={requestText} onChange={event => setRequestText(event.target.value)} /></label>
      <label><span>上下文预算（字符）</span><input className="input" type="number" min={1} max={200000} value={budget} onChange={event => setBudget(Number(event.target.value))} /></label>
    </div>
    <fieldset className="project-context-skills"><legend>当前请求选择的技能</legend>
      {files.filter(file => file.kind === 'skill').map(file => <label key={file.path}><input type="checkbox" checked={selectedSkills.includes(file.title)} onChange={event => setSelectedSkills(event.target.checked ? [...selectedSkills, file.title] : selectedSkills.filter(title => title !== file.title))} />{file.title}</label>)}
      {!files.some(file => file.kind === 'skill') && <span>暂无技能</span>}
    </fieldset>
    <div className="project-context-preview-grid">
      <section><h4>将注入（{preview.used.length}）</h4>{preview.used.map(file => <div className="project-context-preview-item" key={file.path}><FileSummary file={file} /><code>{file.path}</code></div>)}{!preview.used.length && <p>当前请求没有可注入内容。</p>}</section>
      <section><h4>因预算省略（{preview.omitted.length}）</h4>{preview.omitted.map(file => <div className="project-context-preview-item is-omitted" key={file.path}><FileSummary file={file} /><code>{file.path}</code></div>)}{!preview.omitted.length && <p>没有文件因预算被省略。</p>}</section>
    </div>
    <p className="project-context-note"><AppIcon name="info" size={15} />资料仅在名称或别名被提及时注入；技能需显式选择。配置保存为本地 Markdown，不会写入应用设置。</p>
  </section>;
}
