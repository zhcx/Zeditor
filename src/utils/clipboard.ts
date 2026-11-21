/**
 * 剪贴板读写：异步 Clipboard API → 传统 execCommand → 原生兜底的三级降级。
 *
 * WKWebView（macOS）对异步剪贴板的限制比 Chromium 多：
 * - 带 text/html 的 ClipboardItem 写入常被直接拒绝（源码对照与所见即所得的
 *   「复制为 > HTML」因此在 macOS 上静默失效）；
 * - navigator.clipboard.readText() 在缺少用户手势 / 非安全上下文时抛错，
 *   右键菜单「粘贴」于是什么都不发生，用户只看到菜单关掉。
 *
 * 把降级策略集中在这里，让两种编辑器共用同一套行为，避免每个调用点各写一份
 * try/catch 且失败后没有任何反馈。
 */
import { invoke } from '@tauri-apps/api/core';

const isTauriRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** 异步 API 可能在权限弹窗里悬住，超过时限就当作不可用、继续降级。 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/** 选中文字写入剪贴板时，临时夺焦的元素会清掉编辑器选区，先存后还。 */
function captureSelection(): Range[] {
  const selection = window.getSelection();
  if (!selection) return [];
  return Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange());
}

function restoreSelection(ranges: Range[]): void {
  const selection = window.getSelection();
  if (!selection || ranges.length === 0) return;
  selection.removeAllRanges();
  for (const range of ranges) selection.addRange(range);
}

function legacyCopyText(text: string): boolean {
  const holder = document.createElement('textarea');
  holder.value = text;
  holder.setAttribute('readonly', '');
  holder.style.position = 'fixed';
  holder.style.top = '0';
  holder.style.left = '-9999px';
  holder.style.opacity = '0';
  document.body.append(holder);
  const ranges = captureSelection();
  holder.select();
  let copied: boolean;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  holder.remove();
  restoreSelection(ranges);
  return copied;
}

function legacyCopyHtml(html: string): boolean {
  const holder = document.createElement('div');
  holder.contentEditable = 'true';
  holder.style.position = 'fixed';
  holder.style.top = '0';
  holder.style.left = '-9999px';
  holder.innerHTML = html;
  document.body.append(holder);
  const ranges = captureSelection();
  const range = document.createRange();
  range.selectNodeContents(holder);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  let copied: boolean;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  holder.remove();
  restoreSelection(ranges);
  return copied;
}

function legacyReadText(): string | null {
  const holder = document.createElement('textarea');
  holder.value = '';
  holder.style.position = 'fixed';
  holder.style.top = '0';
  holder.style.left = '-9999px';
  holder.style.opacity = '0';
  document.body.append(holder);
  const ranges = captureSelection();
  holder.focus();
  holder.select();
  let value: string | null = null;
  try {
    if (document.execCommand('paste')) value = holder.value;
  } catch {
    value = null;
  }
  holder.remove();
  restoreSelection(ranges);
  return value;
}

/** 写纯文本；返回是否真正写入（调用方据此决定「剪切」要不要删除原文）。 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 非安全上下文 / 缺少用户手势：退回 execCommand。
  }
  return legacyCopyText(text);
}

/** 写富文本（带 text/plain 兜底）；WKWebView 拒绝 ClipboardItem 时退回 execCommand。 */
export async function writeClipboardHtml(html: string, plainText: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      })]);
      return true;
    }
  } catch {
    // WKWebView（macOS）常拒绝带 text/html 的 ClipboardItem 写入。
  }
  return legacyCopyHtml(html);
}

/**
 * 读纯文本。macOS 的 WKWebView 会拒绝 navigator.clipboard.readText()，
 * 此时交给 Rust 端的 `read_clipboard_text`（pbpaste）读系统剪贴板。
 * 返回 null 表示确实读不到，调用方应提示用户改用快捷键而不是静默失败。
 */
export async function readClipboardText(): Promise<string | null> {
  if (navigator.clipboard?.readText) {
    const value = await withTimeout(navigator.clipboard.readText(), 600);
    if (value !== null) return value;
  }
  if (isTauriRuntime()) {
    try {
      const value = await invoke<string | null>('read_clipboard_text');
      if (typeof value === 'string') return value;
    } catch {
      // 命令不存在（旧版本 / 浏览器预览）或原生读取失败，继续降级。
    }
  }
  return legacyReadText();
}
