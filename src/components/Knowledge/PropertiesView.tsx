import { useMemo, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { knowledgeIndexService } from '../../services/knowledgeIndex.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import { parseFrontmatter, updateFrontmatter } from '../../utils/frontmatter.ts';
import { isActiveEditorDocument } from '../../utils/editorDocumentIdentity.ts';
import { propertyText } from './knowledgeModel.ts';
import { KnowledgeEmpty, KnowledgeError } from './KnowledgeStates.tsx';

const FIELDS = [
  { key: 'title', label: '标题' },
  { key: 'status', label: '状态' },
  { key: 'tags', label: '标签' },
  { key: 'due', label: '截止日期' },
] as const;

type PropertyKey = typeof FIELDS[number]['key'];

export function PropertiesView() {
  const currentFile = useAppStore(state => state.currentFile);
  const content = useAppStore(state => state.content);
  const activeTabId = useAppStore(state => state.activeTabId);
  const tab = useAppStore(state => state.tabs.find(item => item.id === state.activeTabId));
  const parsed = useMemo(() => parseFrontmatter(content), [content]);
  const [error, setError] = useState<string | null>(null);
  const snapshotSource = content;
  const snapshotPath = currentFile;
  const snapshotTabId = activeTabId;
  const editable = Boolean(tab && tab.id === activeTabId && tab.path === currentFile && tab.content === content && !parsed.errors.length);

  const commit = (key: PropertyKey, raw: string) => {
    if (!editable || !snapshotTabId) return;
    try {
      const app = useAppStore.getState();
      if (app.activeTabId !== snapshotTabId || app.currentFile !== snapshotPath || app.content !== snapshotSource) {
        setError('文档已切换或内容已变化，请重新编辑'); return;
      }
      if (app.activeTabId === snapshotTabId) app.editorView?.flushPendingEdits?.();
      const latest = useAppStore.getState();
      const latestTab = latest.tabs.find(item => item.id === snapshotTabId);
      if (!isActiveEditorDocument(snapshotTabId, snapshotSource, latest)
        || latest.currentFile !== snapshotPath || latestTab?.path !== snapshotPath) {
        setError('编辑器身份已变化，未写入旧文档'); return;
      }
      const value = key === 'tags'
        ? raw.split(/[,，\s]+/).map(item => item.trim()).filter(Boolean)
        : raw.trim() || null;
      if (JSON.stringify(parsed.data[key]) === JSON.stringify(value)) { setError(null); return; }
      const nextContent = updateFrontmatter(snapshotSource, { [key]: value });
      const controller = latest.editorView;
      const controllerOwnsDocument = controller
        && (controller.tabId === undefined || controller.tabId === snapshotTabId)
        && controller.getValue() === snapshotSource;
      if (controllerOwnsDocument) controller.replaceRange(0, snapshotSource.length, nextContent);
      else latest.updateTabContent(snapshotTabId, nextContent, 'external');
      if (snapshotPath) useKnowledgeStore.getState().upsertCurrentContent(snapshotPath, nextContent);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  const blur = (key: PropertyKey) => (event: FocusEvent<HTMLInputElement>) => commit(key, event.currentTarget.value);
  const enter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
  };
  const valueFor = (key: PropertyKey) => key === 'title'
    ? propertyText(parsed.data.title ?? knowledgeIndexService.get(snapshotPath || '')?.title)
    : propertyText(parsed.data[key]);

  if (!tab) return <KnowledgeEmpty title="没有当前文档" icon="notebook">打开一篇文档后可编辑 frontmatter 属性。</KnowledgeEmpty>;
  return (
    <div className="knowledge-properties">
      <div className="knowledge-toolbar"><span className="knowledge-hint">{snapshotPath || '未保存文档'}</span></div>
      <p className="knowledge-hint">失焦或回车保存到编辑器；一次属性修改只产生一次全文替换。</p>
      {parsed.errors.length > 0 && <KnowledgeError message={`YAML 错误，属性编辑已禁用：${parsed.errors.join('；')}`} />}
      {error && <KnowledgeError message={error} />}
      <table className="knowledge-table knowledge-properties-table">
        <thead><tr><th>属性</th><th>值</th></tr></thead>
        <tbody>{FIELDS.map(field => (
          <tr key={field.key}>
            <th scope="row"><code>{field.key}</code></th>
            <td><input aria-label={field.label} defaultValue={valueFor(field.key)} key={`${snapshotTabId}:${snapshotPath}:${field.key}:${content}`} disabled={!editable} onBlur={blur(field.key)} onKeyDown={enter} /></td>
          </tr>
        ))}</tbody>
      </table>
      <div className="knowledge-boundary"><AppIcon name="info" size={15} />仅更新当前文档内存内容，需通过编辑器正常保存写入磁盘。</div>
    </div>
  );
}
