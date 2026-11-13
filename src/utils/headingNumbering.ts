/**
 * 预览中的标题自动编号（1 / 1.1 / 1.1.1 …）。
 *
 * 只在渲染后的只读 DOM 上运行，不写回 Markdown 源码，也不进入所见即所得的
 * contenteditable 表面（否则编号 span 会被序列化回正文）。可重复调用：每次
 * 先清掉旧编号再重排，避免热更新叠加。
 */

const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6';
const EXCLUDED_ANCESTOR = '.markmap, .workflow-viewer, .workflow-canvas-viewport, [data-no-heading-number]';

export function applyHeadingNumbering(root: HTMLElement): void {
  const counters = [0, 0, 0, 0, 0, 0];
  const headings = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR));
  const doc = root.ownerDocument;

  for (const heading of headings) {
    // 先清掉上一次可能留下的编号。
    heading.querySelectorAll(':scope > .heading-number').forEach((node) => node.remove());
    if (heading.closest(EXCLUDED_ANCESTOR)) continue;

    const level = Number(heading.tagName[1]);
    if (!Number.isInteger(level) || level < 1 || level > 6) continue;

    counters[level - 1] += 1;
    for (let deeper = level; deeper < 6; deeper += 1) counters[deeper] = 0;

    const label = counters.slice(0, level).join('.');
    const span = doc.createElement('span');
    span.className = 'heading-number';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = `${label} `;
    heading.insertBefore(span, heading.firstChild);
  }
}
