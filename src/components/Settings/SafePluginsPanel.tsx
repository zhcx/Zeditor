import { useRef, useState } from 'react';
import { AppIcon } from '../Icons/AppIcon';
import { usePluginStore } from '../../stores/pluginStore';
import './SafePluginsPanel.css';

const EXAMPLE_MANIFEST = {
  id: 'example.safe', name: '安全示例', version: '1.0.0', description: '仅包含声明式命令、斜杠命令和面板',
  permissions: ['commands', 'slash', 'panel'],
  contributions: {
    commands: [
      { id: 'signature', title: '插入签名', action: { type: 'insert-text', text: '——作者' } },
      { id: 'knowledge', title: '打开知识库', action: { type: 'dispatch', event: 'zeditor-open-knowledge' } },
    ],
    slash: [{ id: 'polish', title: '润色提示', insert: '请润色这段文字。' }],
    panels: [{ id: 'guide', title: '使用说明', markdown: '# 安全说明\n\n插件面板仅展示纯文本，不执行脚本。' }],
  },
};

function importError(error: unknown): string {
  return error instanceof Error ? error.message : '导入失败';
}

export function SafePluginsPanel() {
  const { plugins, import: importPlugin, toggle, remove, commands, slashItems, panels } = usePluginStore();
  const commandItems = commands();
  const slashCommandItems = slashItems();
  const panelItems = panels();
  const [manifestText, setManifestText] = useState('');
  const [error, setImportError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importText = () => {
    try {
      const manifest = importPlugin(manifestText);
      setManifestText('');
      setImportError(null);
      setNotice(`已导入：${manifest.name}`);
    } catch (error) {
      setImportError(importError(error));
      setNotice('');
    }
  };
  const importFile = async (file: File) => {
    try {
      const manifest = importPlugin(await file.text());
      setManifestText('');
      setImportError(null);
      setNotice(`已导入：${manifest.name}`);
    } catch (error) {
      setImportError(importError(error));
      setNotice('');
    }
  };

  return <section className="safe-plugins-panel" aria-labelledby="safe-plugins-title">
    <header className="safe-plugins-header"><div><h3 id="safe-plugins-title">安全插件</h3><p>声明式安全 MVP，不执行任意 JS/无文件系统网络权限</p></div><AppIcon name="shield" size={24} /></header>
    <div className="safe-plugins-import">
      <label htmlFor="safe-plugin-manifest">插件 manifest JSON</label>
      <textarea id="safe-plugin-manifest" className="input" value={manifestText} onChange={event => setManifestText(event.target.value)} placeholder="粘贴声明式 manifest JSON" spellCheck={false} />
      <div className="safe-plugins-actions">
        <button type="button" className="button" onClick={() => fileInputRef.current?.click()}><AppIcon name="fileOpen" size={15} />导入 JSON 文件</button>
        <button type="button" className="button" onClick={() => setManifestText(JSON.stringify(EXAMPLE_MANIFEST, null, 2))}>填入示例 manifest</button>
        <button type="button" className="button safe-plugins-primary" disabled={!manifestText.trim()} onClick={importText}>导入 JSON 文本</button>
        <input ref={fileInputRef} className="safe-plugins-file-input" type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ''; }} />
      </div>
      {error && <p className="safe-plugins-error" role="alert">{error}</p>}{notice && <p className="safe-plugins-notice" role="status">{notice}</p>}
    </div>
    <section className="safe-plugins-list" aria-label="插件列表"><h4>插件（{plugins.length}）</h4>
      {plugins.map(record => <article className={`safe-plugin-card ${record.enabled ? 'is-enabled' : 'is-disabled'}`} key={record.manifest.id}>
        <div className="safe-plugin-card-heading"><div><strong>{record.manifest.name}</strong><span>{record.manifest.id} · v{record.manifest.version}</span></div>
          <button type="button" className="button safe-plugins-switch" role="switch" aria-checked={record.enabled} aria-label={`启用 ${record.manifest.name}`} onClick={() => toggle(record.manifest.id)}><span /></button>
          <button type="button" className="button safe-plugins-delete" aria-label={`删除 ${record.manifest.name}`} onClick={() => remove(record.manifest.id)}><AppIcon name="trash" size={15} />删除</button>
        </div>
        {record.manifest.description && <p>{record.manifest.description}</p>}
        <div className="safe-plugin-permissions">{record.manifest.permissions.map(permission => <span key={permission}>{permission}</span>)}</div>
      </article>)}
      {!plugins.length && <p className="safe-plugins-empty">暂无插件。可粘贴 JSON 或导入本地 manifest 文件。</p>}
    </section>
    <div className="safe-plugins-contributions">
      <section><h4>命令（{commandItems.length}）</h4>{commandItems.map(command => <button type="button" className="button safe-plugin-command" key={`${command.pluginId}:${command.id}`} onClick={() => {
        if (command.action.type === 'insert-text') window.dispatchEvent(new CustomEvent('zeditor-plugin-insert', { detail: { text: command.action.text } }));
        else window.dispatchEvent(new CustomEvent(command.action.event));
      }}><AppIcon name="terminal" size={14} /><span>{command.title}<small>{command.pluginName}</small></span></button>)}{!commandItems.length && <p>无启用命令</p>}</section>
      <section><h4>斜杠命令（{slashCommandItems.length}）</h4>{slashCommandItems.map(item => <div className="safe-plugin-slash" key={`${item.pluginId}:${item.id}`}><strong>{item.title}</strong><code>{item.insert}</code></div>)}{!slashCommandItems.length && <p>无启用斜杠命令</p>}</section>
      <section><h4>面板（{panelItems.length}）</h4>{panelItems.map(panel => <details key={`${panel.pluginId}:${panel.id}`}><summary>{panel.title} · {panel.pluginName}</summary><span className="safe-plugin-preview-label">纯文本预览</span><pre className="safe-plugin-panel-preview">{panel.markdown}</pre></details>)}{!panelItems.length && <p>无启用面板</p>}</section>
    </div>
    <p className="safe-plugins-note"><AppIcon name="info" size={15} />仅接受白名单动作；面板 Markdown 不渲染 HTML。导入前会拒绝代码、远程入口和未知权限。</p>
  </section>;
}
