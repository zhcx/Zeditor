import { useAppStore } from '../stores/appStore';
import { useLibraryStore, type SnippetItem, type TemplateItem } from '../stores/libraryStore';
import { expandSnippetTokens, snippetContextFromPath } from '../utils/snippetExpansion';
import { copyMarkdownAsRichHtml } from '../utils/richTextCopy';
import { toast } from '../utils/toast';

/** 当前活动文档的片段上下文。 */
function activeContext() {
  const state = useAppStore.getState();
  const tab = state.getActiveTab();
  return {
    context: snippetContextFromPath(tab?.path ?? null, tab?.title),
    tab,
  };
}

/** 把片段插入到当前光标处（替换选区），光标按 %cursor% 定位。 */
export function insertSnippet(snippet: SnippetItem): void {
  const editorView = useAppStore.getState().editorView;
  if (!editorView) {
    toast('请先将光标放到编辑器中再插入片段', 'error');
    return;
  }
  const { context } = activeContext();
  const { text, cursor } = expandSnippetTokens(snippet.template, context);
  const selection = editorView.getSelection();
  const anchor = cursor !== undefined ? selection.from + cursor : selection.from + text.length;
  editorView.replaceRange(selection.from, selection.to, text, { from: anchor, to: anchor });
  editorView.focus();
  toast(`已插入片段「${snippet.name}」`, 'success');
}

/** 基于模板新建一个未命名文档。 */
export function createNoteFromTemplate(template: TemplateItem): string {
  const state = useAppStore.getState();
  const tab = state.getActiveTab();
  const context = snippetContextFromPath(tab?.path ?? null, tab?.title);
  const { text } = expandSnippetTokens(template.content, context);
  const id = state.addTab({ title: template.name, content: text });
  toast(`已从模板「${template.name}」新建文档`, 'success');
  return id;
}

/** 把当前文档整体复制为富文本，可直接粘贴到 Word / 笔记类应用。 */
export async function copyActiveAsRichText(): Promise<void> {
  const tab = useAppStore.getState().getActiveTab();
  if (!tab) {
    toast('没有可复制的文档', 'error');
    return;
  }
  if (!tab.content.trim()) {
    toast('文档为空，无法复制', 'error');
    return;
  }
  try {
    await copyMarkdownAsRichHtml(tab.content, true);
    toast('已复制为富文本，可直接粘贴到其他应用', 'success');
  } catch (error) {
    toast(`复制失败：${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

/** 置顶/取消置顶一个文件或文件夹。 */
export function togglePinPath(path: string, title: string, type: 'file' | 'folder'): void {
  const pinnedNow = useLibraryStore.getState().togglePin({ path, title, type });
  toast(pinnedNow ? `已置顶「${title}」` : `已取消置顶「${title}」`, 'success');
}
