import { useCallback, useEffect, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import { loadMonaco } from './monacoLoader.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { installWikiCompletionProvider, registerSecondaryWikiPath } from '../../utils/wikiCompletionProvider.ts';
import { getFocusedSecondaryEditor, installEditorFocusTracking, setFocusedSecondaryEditor, type FocusedDocumentEditor } from '../../services/editorFocus.ts';

installEditorFocusTracking();

const models = new Map<string, Monaco.editor.ITextModel>();

interface SecondaryEditorProps {
  tabId: string;
  title: string;
  content: string;
  modified: boolean;
  path: string | null;
  onClose: () => void;
}

/** 分栏中的独立源码编辑器；不竞争全局 EditorController。 */
export function SecondaryEditor({ tabId, title, content, modified, path, onClose }: SecondaryEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null);
  const updateTabContent = useAppStore(state => state.updateTabContent);
  const saveTab = useAppStore(state => state.saveTab);
  const handleChange = useCallback((value: string) => updateTabContent(tabId, value, 'editor'), [tabId, updateTabContent]);
  const saveSecondary = useCallback(() => {
    if (modelRef.current) handleChange(modelRef.current.getValue());
    const tab = useAppStore.getState().tabs.find(item => item.id === tabId);
    if (tab?.path) void saveTab(tab.id, tab.path);
  }, [tabId, saveTab, handleChange]);
  const [ready, setReady] = useState(false);
  const theme = useAppStore(state => state.settings.appearance.theme);

  useEffect(() => {
    let cancelled = false;
    let changeDisposer: Monaco.IDisposable | null = null;
    let focusDisposer: Monaco.IDisposable | null = null;
    let ownedModel: Monaco.editor.ITextModel | null = null;
    let focusedTarget: FocusedDocumentEditor | null = null;
    void loadMonaco().then(monaco => {
      if (cancelled || !hostRef.current) return;
      installWikiCompletionProvider(monaco);
      const uri = monaco.Uri.parse(`inmemory://zeditor-secondary/${encodeURIComponent(tabId)}`);
      const initialContent = useAppStore.getState().tabs.find(item => item.id === tabId)?.content ?? '';
      let model = models.get(tabId);
      if (!model || model.uri.toString() !== uri.toString()) {
        model = monaco.editor.createModel(initialContent, 'markdown', uri);
        models.set(tabId, model);
      } else if (model.getValue() !== initialContent) {
        model.setValue(initialContent);
      }
      ownedModel = model;
      modelRef.current = model;
      const editor = monaco.editor.create(hostRef.current, {
        model,
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: 'on',
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        padding: { top: 12 },
      });
      editorRef.current = editor;
      changeDisposer = model.onDidChangeContent(() => {
        handleChange(model!.getValue());
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveSecondary);
      focusedTarget = {
        tabId,
        undo: () => { editor.trigger('native-menu', 'undo', null); },
        redo: () => { editor.trigger('native-menu', 'redo', null); },
        focus: () => editor.focus(),
      };
      focusDisposer = editor.onDidFocusEditorText(() => setFocusedSecondaryEditor(focusedTarget));
      setReady(true);
    });
    return () => {
      cancelled = true;
      changeDisposer?.dispose();
      focusDisposer?.dispose();
      if (focusedTarget && getFocusedSecondaryEditor() === focusedTarget) setFocusedSecondaryEditor(null);
      editorRef.current?.dispose();
      editorRef.current = null;
      modelRef.current = null;
      setReady(false);
      if (ownedModel) {
        if (models.get(tabId) === ownedModel) models.delete(tabId);
        ownedModel.dispose();
        ownedModel = null;
      }
    };
  }, [tabId, saveSecondary, handleChange]);

  useEffect(() => {
    const model = modelRef.current;
    if (model && model.getValue() !== content) model.setValue(content);
    registerSecondaryWikiPath(tabId, path);
  }, [content, path, tabId]);

  useEffect(() => {
    void loadMonaco().then(monaco => monaco.editor.setTheme(theme));
  }, [theme]);

  return (
    <section className="secondary-editor-pane" aria-label={`分栏编辑：${title}`}>
      <header className="secondary-editor-header">
        <span className="secondary-editor-title" title={path ?? title}>{modified ? '● ' : ''}{title}</span>
        <button type="button" onClick={saveSecondary} disabled={!modified || !path}>保存</button>
        <button type="button" onClick={onClose} aria-label="关闭分栏">×</button>
      </header>
      <div ref={hostRef} className="secondary-editor-host">
        {!ready && <div className="secondary-editor-loading">正在加载分栏编辑器…</div>}
      </div>
    </section>
  );
}
