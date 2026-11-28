import type { ReactNode } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import type { IconName } from '../Icons/iconGeometry.ts';

export function KnowledgeEmpty({ title, children, icon = 'notebook' }: {
  title: string;
  children?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="knowledge-empty">
      <AppIcon name={icon} size={28} />
      <strong>{title}</strong>
      {children && <div className="knowledge-empty-detail">{children}</div>}
    </div>
  );
}

export function KnowledgeError({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="knowledge-error" role="alert">
      <AppIcon name="warning" size={16} />
      <span>{message}</span>
      {onDismiss && <button type="button" aria-label="关闭错误提示" onClick={onDismiss}><AppIcon name="close" size={14} /></button>}
    </div>
  );
}

export function KnowledgeLoading({ label = '正在扫描知识库…' }: { label?: string }) {
  return <div className="knowledge-loading" role="status"><AppIcon name="refresh" size={15} className="knowledge-spin" />{label}</div>;
}
