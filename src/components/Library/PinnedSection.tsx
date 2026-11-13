import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../stores/appStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { AppIcon } from '../Icons/AppIcon';

/**
 * 侧栏「快速访问」置顶区（P0-3）。展示用户置顶的文件/文件夹，点击打开，
 * 右侧按钮可取消置顶。与「最近打开」区域结构一致。
 */
export function PinnedSection() {
  const { pinned, unpin } = useLibraryStore(useShallow((s) => ({ pinned: s.pinned, unpin: s.unpin })));
  const openFile = useAppStore((s) => s.openFile);
  const [expanded, setExpanded] = useState(true);

  if (!pinned.length) return null;

  return (
    <section className="explorer-section pinned-section">
      <button
        type="button"
        className="explorer-section-heading"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={`explorer-chevron ${expanded ? 'expanded' : ''}`} aria-hidden="true"><AppIcon name="chevronRight" size={14} /></span>
        <span>快速访问</span>
        <span className="pinned-count">{pinned.length}</span>
      </button>
      {expanded && (
        <div className="explorer-section-body">
          {pinned.map((item) => (
            <div className="pinned-row-wrapper" key={item.path}>
              <button
                type="button"
                className="explorer-row file-row pinned-row"
                title={item.path}
                onClick={() => { void openFile(item.path); }}
              >
                <AppIcon name={item.type === 'folder' ? 'folder' : 'file'} className="explorer-icon" size={16} />
                <span className="explorer-row-label">{item.title}</span>
              </button>
              <button
                type="button"
                className="pinned-unpin-btn"
                title="取消置顶"
                aria-label={`取消置顶 ${item.title}`}
                onClick={(e) => { e.stopPropagation(); unpin(item.path); }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
