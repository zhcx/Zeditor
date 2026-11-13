/**
 * 链接悬浮预览（P1-6）。
 *
 * 在预览/只读渲染层给 `<a>` 增加悬停卡片：外部链接显示域名与完整 URL，本地
 * Markdown/文本链接通过 Tauri 命令 `link_preview` 读取首段内容做摘要。浏览器
 * 预览（无 Tauri）下只显示路径提示。所有文本都经过转义后写入，避免注入。
 */
import { invoke } from '@tauri-apps/api/core';

interface LinkPreviewOptions {
  /** 当前文档的磁盘路径，用于解析相对链接。 */
  documentPath?: string | null;
  /** 悬停多少毫秒后弹出。 */
  delay?: number;
}

interface LinkPreviewPayload {
  exists: boolean;
  title?: string;
  snippet?: string;
  isMarkdown?: boolean;
  error?: string;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '';
}

function normalizePosix(path: string): string {
  const parts = path.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '' && stack.length) continue;
    if (part === '.') continue;
    if (part === '..') {
      if (stack.length && stack[stack.length - 1] !== '..') stack.pop();
      else stack.push('..');
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

export function resolveLocalHref(href: string, documentPath?: string | null): string | null {
  if (!href || href.startsWith('#')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^file:/i.test(href)) return null;
  const noScheme = href.replace(/^file:\/\//i, '');
  const [pathPart] = noScheme.split('#');
  const clean = decodeURIComponent(pathPart.split('?')[0] ?? '');
  if (!clean) return null;
  if (/^[a-zA-Z]:[\\/]/.test(clean)) return clean.replace(/\\/g, '/');
  if (clean.startsWith('/')) return clean;
  const base = documentPath ? dirname(documentPath) : '';
  return normalizePosix(base ? `${base}/${clean}` : clean);
}

export function attachLinkPreview(root: HTMLElement, options: LinkPreviewOptions = {}): () => void {
  const { documentPath, delay = 260 } = options;
  const doc = root.ownerDocument;
  const popup = doc.createElement('div');
  popup.className = 'zeditor-link-preview';
  popup.style.display = 'none';
  doc.body.appendChild(popup);

  let timer: number | null = null;
  let pending: string | null = null;
  let hideTimer: number | null = null;

  const hide = () => {
    if (timer !== null) { window.clearTimeout(timer); timer = null; }
    pending = null;
    popup.style.display = 'none';
  };

  const scheduleHide = () => {
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hide, 120);
  };

  const show = (anchor: HTMLAnchorElement, content: string) => {
    popup.innerHTML = content;
    popup.style.display = 'block';
    const rect = anchor.getBoundingClientRect();
    const width = 340;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 12);
    let top = rect.bottom + 8;
    const estimated = popup.offsetHeight || 90;
    if (top + estimated > window.innerHeight - 8) top = Math.max(8, rect.top - estimated - 8);
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.width = `${width}px`;
  };

  const buildExternal = (href: string): string => {
    let host = href;
    try { host = new URL(href).host; } catch { /* keep raw */ }
    return `<div class="zeditor-link-preview-host">${escapeHtml(host)}</div>`
      + `<div class="zeditor-link-preview-url">${escapeHtml(href)}</div>`
      + '<div class="zeditor-link-preview-hint">Ctrl / ⌘ + 点击在浏览器打开</div>';
  };

  const handleOver = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
    if (!anchor || !root.contains(anchor)) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    if (hideTimer !== null) { window.clearTimeout(hideTimer); hideTimer = null; }

    if (href.startsWith('#')) {
      show(anchor, `<div class="zeditor-link-preview-title">${escapeHtml(anchor.textContent?.trim() || '锚点')}</div><div class="zeditor-link-preview-hint">跳转到本文档锚点</div>`);
      return;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^file:/i.test(href)) {
      show(anchor, buildExternal(href));
      return;
    }

    const localPath = resolveLocalHref(href, documentPath);
    if (!localPath) return;
    if (pending === localPath && popup.style.display !== 'none') return;
    pending = localPath;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      if (pending !== localPath) return;
      if (!isTauri()) {
        show(anchor, `<div class="zeditor-link-preview-title">${escapeHtml(localPath)}</div><div class="zeditor-link-preview-hint">本地链接（点击打开）</div>`);
        return;
      }
      try {
        const payload = await invoke<LinkPreviewPayload>('link_preview', { path: localPath });
        if (pending !== localPath) return;
        if (!payload.exists) {
          show(anchor, `<div class="zeditor-link-preview-title">${escapeHtml(localPath)}</div><div class="zeditor-link-preview-hint">文件不存在</div>`);
          return;
        }
        const snippet = payload.snippet ? `<div class="zeditor-link-preview-snippet">${escapeHtml(payload.snippet)}</div>` : '';
        show(anchor, `<div class="zeditor-link-preview-title">${escapeHtml(payload.title || localPath)}</div>${snippet}<div class="zeditor-link-preview-hint">点击打开</div>`);
      } catch {
        show(anchor, `<div class="zeditor-link-preview-title">${escapeHtml(localPath)}</div><div class="zeditor-link-preview-hint">本地链接（点击打开）</div>`);
      }
    }, delay);
  };

  const handleOut = () => scheduleHide();
  const handleScroll = () => hide();

  root.addEventListener('mouseover', handleOver);
  root.addEventListener('mouseout', handleOut);
  doc.addEventListener('scroll', handleScroll, true);
  window.addEventListener('blur', hide);

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    root.removeEventListener('mouseover', handleOver);
    root.removeEventListener('mouseout', handleOut);
    doc.removeEventListener('scroll', handleScroll, true);
    window.removeEventListener('blur', hide);
    popup.remove();
  };
}
