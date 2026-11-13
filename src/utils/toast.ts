/** 轻量级瞬时提示：右下角浮层，几秒后自动消失。无第三方依赖。 */

let container: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (container && container.isConnected) return container;
  container = document.createElement('div');
  container.className = 'zeditor-toast-container';
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

export function toast(message: string, kind: 'info' | 'success' | 'error' = 'info', duration = 2200): void {
  if (typeof document === 'undefined' || !document.body) return;
  const host = ensureContainer();
  const node = document.createElement('div');
  node.className = `zeditor-toast zeditor-toast-${kind}`;
  node.textContent = message;
  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  window.setTimeout(() => {
    node.classList.remove('is-visible');
    window.setTimeout(() => node.remove(), 220);
  }, duration);
}
