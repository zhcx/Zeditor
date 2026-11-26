import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { knowledgeIndexService } from '../../services/knowledgeIndex.ts';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import { analyzeObsidianVault, notionHtmlToMarkdown, validateTyporaTheme, type MigrationFile, type ObsidianMigrationReport } from '../../utils/migration.ts';
import { scanMigrationVault } from '../../services/migrationScan.ts';
import { importNotionHtml } from '../../services/migrationImport.ts';
import { notesToMigrationFiles } from './knowledgeModel.ts';
import { KnowledgeError, KnowledgeLoading } from './KnowledgeStates.tsx';

export function MigrationView() {
  const activeRoot = useKnowledgeStore(state => state.activeRoot);
  const scanning = useKnowledgeStore(state => state.scanning);
  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState('');
  const [css, setCss] = useState('');
  const [themeStatus, setThemeStatus] = useState('');
  const [report, setReport] = useState<ObsidianMigrationReport | null>(null);
  const [analysisRoot, setAnalysisRoot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const convert = () => {
    try { setPreview(notionHtmlToMarkdown(html, title)); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const readHtml = async (file?: File) => {
    if (!file) return;
    try {
      setHtml(await file.text());
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
      setError(null);
    } catch (reason) { setError(`读取 HTML 失败：${String(reason)}`); }
  };
  const buildReport = (root: string, files: MigrationFile[]) => {
    setAnalysisRoot(root);
    setReport(analyzeObsidianVault(files));
  };
  const analyzeRoot = async (root: string) => {
    setBusy(true); setError(null);
    try {
      buildReport(root, await scanMigrationVault(root));
    } catch (reason) { setError(`分析失败：${String(reason)}`); }
    finally { setBusy(false); }
  };
  const analyzeFolder = async (files: FileList) => {
    const relative = files[0]?.webkitRelativePath || '';
    const root = relative.includes('/') ? relative.split('/')[0] : '';
    if (!root) { setError('请选择文件夹，而不是单个文件'); return; }
    setBusy(true); setError(null);
    try {
      const entries = await Promise.all([...files].slice(0, 5000).map(async file => ({
        path: file.webkitRelativePath.split('/').slice(1).join('/'),
        content: /\.md$/i.test(file.name) ? await file.text() : '',
      })));
      buildReport(root, entries);
    } catch (reason) { setError(`分析失败：${String(reason)}`); }
    finally { setBusy(false); }
  };
  const selectVault = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      const root = Array.isArray(selected) ? selected[0] : selected;
      if (root) await analyzeRoot(root);
    } catch (reason) { setError(`选择文件夹失败：${String(reason)}`); }
  };
  const analyzeIndex = () => {
    if (!activeRoot) { setError('请先选择或扫描 Obsidian vault'); return; }
    buildReport(activeRoot, notesToMigrationFiles(knowledgeIndexService.all()));
  };
  const importMarkdown = async () => {
    if (!activeRoot) { setError('请先选择用于接收导入的知识库根目录'); return; }
    setBusy(true); setError(null); setNotice('');
    try {
      const result = await importNotionHtml(html, title || 'Notion 页面', activeRoot);
      setNotice(result.created ? `已导入：${result.path}` : '同名文件已存在，未覆盖。');
    } catch (reason) { setError(`导入失败：${String(reason)}`); }
    finally { setBusy(false); }
  };
  const validateTheme = () => {
    try {
      validateTyporaTheme(css);
      setThemeStatus('CSS 校验通过；仅验证，未应用主题。');
      setError(null);
    } catch (reason) { setThemeStatus(''); setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  return (
    <div className="knowledge-migration">
      <div className="knowledge-boundary"><AppIcon name="info" size={15} /><span>Obsidian 只读分析，不修改原 vault；Notion 可导入到当前知识库的 imported 目录；Typora 仅校验 CSS。</span></div>
      {error && <KnowledgeError message={error} />}
      {(scanning || busy) && <KnowledgeLoading label="正在扫描并分析…" />}
      <section className="knowledge-migration-section">
        <h3>Notion HTML → Markdown</h3>
        <label className="knowledge-file-button"><AppIcon name="fileOpen" size={15} />选择 HTML 文件<input type="file" accept=".html,.htm,text/html" onChange={event => void readHtml(event.target.files?.[0])} /></label>
        <input aria-label="Markdown 标题" placeholder="可选标题" value={title} onChange={event => setTitle(event.target.value)} />
        <textarea aria-label="Notion HTML 源文本" placeholder="粘贴 Notion 导出的 HTML" value={html} onChange={event => setHtml(event.target.value)} />
        <button type="button" disabled={!html.trim()} onClick={convert}><AppIcon name="fileConvert" size={15} />转换预览</button>
        <button type="button" disabled={!html.trim() || busy || !activeRoot} onClick={() => void importMarkdown()}><AppIcon name="plus" size={15} />导入为新 Markdown</button>
        <textarea aria-label="Markdown 转换预览" className="knowledge-preview" placeholder="转换结果（只读）" readOnly value={preview} />
        {notice && <p className="knowledge-success" role="status">{notice}</p>}
      </section>
      <section className="knowledge-migration-section">
        <h3>Obsidian vault 分析</h3>
        <button type="button" disabled={busy || scanning} onClick={() => void selectVault()}><AppIcon name="folderOpen" size={15} />选择 vault 文件夹</button>
        <label className="knowledge-file-button"><AppIcon name="folderOpen" size={15} />浏览器文件夹预览<input ref={node => { node?.setAttribute('webkitdirectory', ''); }} type="file" multiple onChange={event => event.target.files && void analyzeFolder(event.target.files)} /></label>
        <button type="button" disabled={!activeRoot || scanning} onClick={analyzeIndex}>分析当前已扫描索引</button>
        <p className="knowledge-hint">选择 vault 会扫描 Markdown、附件与 .obsidian 配置；分析当前索引时仅含 Markdown。</p>
        {report && (
          <dl className="knowledge-report">
            <div><dt>分析根目录</dt><dd>{analysisRoot}</dd></div>
            <div><dt>Markdown</dt><dd>{report.markdownFiles}</dd></div>
            <div><dt>日记</dt><dd>{report.dailyNotes}</dd></div>
            <div><dt>未解析链接</dt><dd>{report.unresolvedLinks.length}</dd></div>
            {report.warnings.map(warning => <div key={warning}><dt>提示</dt><dd>{warning}</dd></div>)}
          </dl>
        )}
      </section>
      <section className="knowledge-migration-section">
        <h3>Typora CSS 校验</h3>
        <textarea aria-label="Typora CSS 源文本" placeholder="粘贴本地 CSS；拒绝 @import 与外部 URL" value={css} onChange={event => { setCss(event.target.value); setThemeStatus(''); }} />
        <button type="button" disabled={!css.trim()} onClick={validateTheme}><AppIcon name="check" size={15} />校验 CSS</button>
        {themeStatus && <p className="knowledge-success" role="status">{themeStatus}</p>}
      </section>
    </div>
  );
}
