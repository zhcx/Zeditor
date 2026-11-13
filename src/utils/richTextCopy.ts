import { renderMarkdownToHtml } from './markdownPipeline';
import { enhanceExportHtml } from './exportDiagrams';

/**
 * 把 Markdown 复制为「富文本」，可直接粘贴到 Word / 企业微信 / 飞书 / Notion /
 * 印象笔记等支持 HTML 剪贴板的目标。样式一律内联，避免目标应用忽略 <style>。
 */

const FONT = '"Microsoft YaHei","微软雅黑","PingFang SC",system-ui,sans-serif';
const COLORS = { primary: '#2563eb', pale: '#eef4ff', ink: '#1f2933', accent: '#f59e0b' };

const text = `font-family:${FONT};color:${COLORS.ink};line-height:1.8;font-size:15px;`;

function inlineStyledHtml(bodyHtml: string): string {
  const doc = new DOMParser().parseFromString(`<section>${bodyHtml}</section>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  root.setAttribute('style', `margin:0;padding:4px 0;${text}`);

  root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,p,blockquote,pre,ul,ol,li,table,th,td,a,img,figure,figcaption,hr,code,strong,em,del').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1') el.setAttribute('style', `margin:28px 0 16px;padding-bottom:10px;border-bottom:2px solid ${COLORS.primary};font-size:26px;line-height:1.35;font-weight:700;${text}`);
    else if (/^h[2-6]$/.test(tag)) el.setAttribute('style', `margin:24px 0 12px;padding-left:10px;border-left:4px solid ${COLORS.primary};font-size:${tag === 'h2' ? 21 : 18}px;line-height:1.45;font-weight:700;${text}`);
    else if (tag === 'p') el.setAttribute('style', `margin:0 0 16px;${text}`);
    else if (tag === 'blockquote') el.setAttribute('style', `margin:20px 0;padding:14px 16px;border-left:4px solid ${COLORS.primary};background:${COLORS.pale};color:${COLORS.ink};${text}`);
    else if (tag === 'pre') el.setAttribute('style', `margin:18px 0;padding:14px 16px;overflow:auto;border-radius:7px;background:#1f2937;color:#e5e7eb;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;line-height:1.6;white-space:pre;`);
    else if (tag === 'code' && el.parentElement?.tagName !== 'PRE') el.setAttribute('style', `padding:2px 5px;border-radius:3px;background:${COLORS.pale};color:${COLORS.primary};font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:0.9em;`);
    else if (tag === 'ul' || tag === 'ol') el.setAttribute('style', `margin:0 0 16px;padding-left:24px;${text}`);
    else if (tag === 'li') el.setAttribute('style', `margin:6px 0;${text}`);
    else if (tag === 'table') el.setAttribute('style', 'width:100%;margin:18px 0;border-collapse:collapse;font-size:14px;line-height:1.6;');
    else if (tag === 'th') el.setAttribute('style', `padding:8px 10px;border:1px solid ${COLORS.primary};background:${COLORS.primary};color:#fff;text-align:left;`);
    else if (tag === 'td') el.setAttribute('style', `padding:8px 10px;border:1px solid ${COLORS.primary}44;${text}`);
    else if (tag === 'a') el.setAttribute('style', `color:${COLORS.primary};text-decoration:underline;`);
    else if (tag === 'strong') el.setAttribute('style', `font-weight:700;${text}`);
    else if (tag === 'em') el.setAttribute('style', `font-style:italic;${text}`);
    else if (tag === 'del') el.setAttribute('style', `text-decoration:line-through;${text}`);
    else if (tag === 'img') el.setAttribute('style', 'display:block;max-width:100%;height:auto;margin:20px auto;border-radius:4px;');
    else if (tag === 'figure') el.setAttribute('style', 'margin:20px 0;text-align:center;');
    else if (tag === 'figcaption') el.setAttribute('style', `margin:6px 0;font-size:12px;line-height:1.5;color:#6b7280;`);
    else if (tag === 'hr') el.setAttribute('style', `margin:26px 0;border:0;border-top:1px solid ${COLORS.primary}55;`);
  });
  return root.outerHTML;
}

export async function copyRichHtml(html: string): Promise<void> {
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' }),
      })]);
      return;
    } catch {
      // WKWebView（macOS）以及非安全上下文 / 缺少用户手势的浏览器可能拒绝
      // 带 text/html 的 ClipboardItem 写入；退回 execCommand 兜底，避免
      // 「复制为富文本」在 macOS 上直接抛错。
    }
  }
  fallbackCopyHtml(html);
}

function fallbackCopyHtml(html: string): void {
  const holder = document.createElement('div');
  holder.contentEditable = 'true';
  holder.style.position = 'fixed';
  holder.style.left = '-9999px';
  holder.innerHTML = html;
  document.body.append(holder);
  const range = document.createRange();
  range.selectNodeContents(holder);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.execCommand('copy');
  holder.remove();
}

/** 渲染 Markdown 为带内联样式的富文本 HTML（图表按浅色转内联 PNG）。 */
export async function renderRichHtml(markdown: string, workflowViewerEnabled = true): Promise<string> {
  const base = renderMarkdownToHtml(markdown || '暂无内容');
  let body: string;
  try {
    const enhanced = await enhanceExportHtml(base, {
      mode: 'image',
      theme: 'light',
      background: '#ffffff',
      workflowViewerEnabled,
    });
    body = enhanced.html;
  } catch {
    body = base;
  }
  return inlineStyledHtml(body);
}

/** 复制整篇 Markdown 为富文本。 */
export async function copyMarkdownAsRichHtml(markdown: string, workflowViewerEnabled = true): Promise<void> {
  const html = await renderRichHtml(markdown, workflowViewerEnabled);
  await copyRichHtml(html);
}
