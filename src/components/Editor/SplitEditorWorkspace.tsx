import { useEffect, useRef, type ReactNode } from 'react';
import { SecondaryEditor } from './SecondaryEditor.tsx';
import { useAppStore } from '../../stores/appStore.ts';
import { useWorkspaceLayoutStore } from '../../stores/workspaceLayoutStore.ts';
import '../../styles/splitWorkspace.css';

export function SplitEditorWorkspace({ children }: { children: ReactNode }) {
  const tabs = useAppStore(state => state.tabs);
  const activeTabId = useAppStore(state => state.activeTabId);
  const mode = useAppStore(state => state.mode);
  const { enabled, secondaryTabId, orientation, ratio, setSecondaryTab, setOrientation, setRatio, disableSplit } = useWorkspaceLayoutStore();
  const hostRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const secondary = tabs.find(tab => tab.id === secondaryTabId && tab.id !== activeTabId);
  const alternatives = tabs.filter(tab => tab.id !== activeTabId);

  useEffect(() => {
    if (!enabled || !alternatives.length) return;
    if (!secondaryTabId || secondaryTabId === activeTabId || !tabs.some(tab => tab.id === secondaryTabId)) {
      setSecondaryTab(alternatives[0].id);
    }
  }, [enabled, activeTabId, secondaryTabId, tabs, alternatives, setSecondaryTab]);

  if (!enabled) return <>{children}</>;

  const updateRatio = (clientX: number, clientY: number) => {
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = orientation === 'horizontal'
      ? (clientX - rect.left) / rect.width
      : (clientY - rect.top) / rect.height;
    setRatio(next);
  };

  const style = orientation === 'horizontal'
    ? { gridTemplateColumns: `minmax(0, ${ratio}fr) 6px minmax(0, ${1 - ratio}fr)` }
    : { gridTemplateRows: `minmax(0, ${ratio}fr) 6px minmax(0, ${1 - ratio}fr)` };

  return (
    <div className="split-editor-shell">
      <header className="split-editor-toolbar">
        <label>分栏文档
          <select value={secondary?.id ?? ''} onChange={event => setSecondaryTab(event.target.value)} disabled={!alternatives.length}>
            {!alternatives.length && <option value="">请先打开另一篇文档</option>}
            {alternatives.map(tab => <option key={tab.id} value={tab.id}>{tab.title}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal')}>
          {orientation === 'horizontal' ? '上下分栏' : '左右分栏'}
        </button>
        <button type="button" onClick={disableSplit}>关闭分栏</button>
      </header>
      <div ref={hostRef} className={`split-editor-workspace split-${orientation}`} style={style}>
        <div className={`split-editor-main split-editor-main-${mode}`}>{children}</div>
        <div
          className="split-editor-divider"
          role="separator"
          aria-label="调整分栏比例"
          aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
          aria-valuemin={25}
          aria-valuemax={75}
          aria-valuenow={Math.round(ratio * 100)}
          tabIndex={0}
          onPointerDown={event => { draggingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { if (draggingRef.current) updateRatio(event.clientX, event.clientY); }}
          onPointerUp={() => { draggingRef.current = false; }}
          onKeyDown={event => {
            const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -0.05 : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 0.05 : 0;
            if (delta) { event.preventDefault(); setRatio(ratio + delta); }
          }}
        />
        {secondary
          ? <SecondaryEditor tabId={secondary.id} title={secondary.title} content={secondary.content} modified={secondary.modified} path={secondary.path} onClose={disableSplit} />
          : <div className="split-editor-empty">打开另一篇文档后可在此独立编辑。</div>}
      </div>
    </div>
  );
}
