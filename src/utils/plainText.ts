/**
 * 选中 Markdown 源码 → 纯文本（右键菜单「复制为 > 纯文本」）。
 *
 * 只做「去掉 Markdown 修饰、留下文字」这一步，不做 HTML 转换：
 * 与 stripInlineFormatting（清除行内格式）不同，这里还要处理链接与图片语法，
 * 让复制出来的内容能直接粘进聊天框 / 搜索框。
 */
export function markdownSelectionToPlainText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/(\*\*\*|___)(.+?)\1/g, '$2')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    // 单星号 / 单下划线强调：要求两侧是非单词字符，避免把 foo_bar_baz 吃成 foobarbaz。
    .replace(/(^|[^\w*])\*([^\s*](?:[^*]*[^\s*])?)\*(?![\w*])/g, '$1$2')
    .replace(/(^|[^\w])_([^\s_](?:[^_]*[^\s_])?)_(?![\w])/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1');
}
