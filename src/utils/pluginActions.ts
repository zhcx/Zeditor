import type { PluginAction } from './pluginManifest.ts';
import type { EditorController } from '../types/editor.ts';

const ALLOWED_EVENTS = new Set(['zeditor-open-knowledge', 'zeditor-add-review-note', 'zeditor-toggle-split']);

export function executePluginAction(action: PluginAction, editor: EditorController | null): void {
  if (action.type === 'insert-text') {
    if (!editor) throw new Error('当前没有可写的编辑器');
    const selection = editor.getSelection();
    editor.replaceRange(selection.from, selection.to, action.text);
    editor.focus();
    return;
  }
  if (!ALLOWED_EVENTS.has(action.event)) throw new Error('插件事件不在白名单中');
  window.dispatchEvent(new CustomEvent(action.event));
}

export function executePluginCommand(
  command: { action: PluginAction; [key: string]: unknown },
  editor: EditorController | null,
): void {
  executePluginAction(command.action, editor);
}
