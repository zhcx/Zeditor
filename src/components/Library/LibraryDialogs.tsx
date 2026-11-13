import { useLibraryStore } from '../../stores/libraryStore';
import { SnippetsDialog } from './SnippetsDialog';
import { TemplatesDialog } from './TemplatesDialog';
import './library.css';

/** 资料库弹窗的统一挂载点（片段 / 模板）。 */
export function LibraryDialogs() {
  const dialog = useLibraryStore((s) => s.dialog);
  const setDialog = useLibraryStore((s) => s.setDialog);

  if (!dialog) return null;
  const close = () => setDialog(null);

  if (dialog === 'snippets') return <SnippetsDialog onClose={close} />;
  if (dialog === 'templates') return <TemplatesDialog onClose={close} />;
  return null;
}
