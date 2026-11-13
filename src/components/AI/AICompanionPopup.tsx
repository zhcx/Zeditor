import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAIStore } from '../../stores/aiStore';
import { useAppStore } from '../../stores/appStore';

export function AICompanionPopup() {
  const {
    companionVisible,
    companionPosition,
    companionSuggestions,
    status,
    statusMessage,
    applySuggestion,
    requestCompanion,
    dismissCompanion,
  } = useAIStore(useShallow(state => ({ companionVisible: state.companionVisible, companionPosition: state.companionPosition, companionSuggestions: state.companionSuggestions, status: state.status, statusMessage: state.statusMessage, applySuggestion: state.applySuggestion, requestCompanion: state.requestCompanion, dismissCompanion: state.dismissCompanion })));
  const currentStyle = useAppStore((state) => state.settings.ai.writing_style);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companionVisible) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!popupRef.current?.contains(event.target as Node)) dismissCompanion();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dismissCompanion();
      }
    };
    // 捕获阶段处理：Monaco 与 contenteditable 都可能在自己的鼠标回调里停止冒泡。
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [companionVisible, dismissCompanion]);

  if (!companionVisible || !companionPosition) return null;

  const isLoading = status === 'companion' || status === 'loading';
  const isError = status === 'error';
  const suggestions = companionSuggestions
    .map(suggestion => suggestion.trim())
    .filter(Boolean);

  const handleApply = (suggestion: string) => {
    applySuggestion(suggestion);
  };

  const handleRefresh = () => {
    // 与自动触发共用入口：源码与所见即所得都会先 flush 编辑，再读取最新光标上下文。
    requestCompanion();
  };

  const handleClose = () => {
    dismissCompanion();
  };

  // 靠近右侧/底部时向内收拢；底部空间不足则改到光标上方，避免操作按钮被裁掉。
  const below = companionPosition.y + 14;
  const popupStyle: React.CSSProperties = {
    left: Math.max(12, Math.min(companionPosition.x, window.innerWidth - 452)),
    top: below + 380 <= window.innerHeight ? below : Math.max(12, companionPosition.y - 380),
  };

  return (
    <div ref={popupRef} className="ai-companion-popup" style={popupStyle} role="dialog" aria-label="AI 伴写">
      <div className="ai-companion-header">
        <div>
          <div className="ai-companion-title">AI伴写</div>
          <div className="ai-companion-subtitle">根据光标前文自动续写</div>
        </div>
        <span className="style-badge">{getStyleLabel(currentStyle)}</span>
      </div>
      <div className="ai-suggestion-list">
        {isLoading ? (
          <div className="ai-suggestion-state">
            <span className="ai-spinner"></span>
            <span>正在生成更贴合上下文的续写...</span>
          </div>
        ) : isError ? (
          <div className="ai-suggestion-state error">
            {statusMessage || '生成伴写建议失败，请检查 AI 配置后重试'}
          </div>
        ) : suggestions.length > 0 ? (
          suggestions.map((suggestion, index) => (
            <button
              key={index}
              className="ai-suggestion-item"
              onClick={() => handleApply(suggestion)}
            >
              <span className="ai-suggestion-index">{index + 1}</span>
              <span className="ai-suggestion-content">{suggestion}</span>
              <span className="ai-suggestion-action">采用</span>
            </button>
          ))
        ) : (
          <div className="ai-suggestion-state muted">
            暂无可用建议，试着多写一点上下文后刷新
          </div>
        )}
      </div>
      <div className="ai-companion-footer">
        <span className="ai-companion-tip">点击任一建议插入到当前光标处</span>
        <button className="ai-companion-btn refresh" onClick={handleRefresh}>
          刷新
        </button>
        <button className="ai-companion-btn close" onClick={handleClose}>
          关闭
        </button>
      </div>
    </div>
  );
}

function getStyleLabel(style: string): string {
  const labels: Record<string, string> = {
    formal: '正式',
    casual: '活泼',
    academic: '学术',
    creative: '创意',
    custom: '自定义'
  };
  return labels[style] || style;
}
