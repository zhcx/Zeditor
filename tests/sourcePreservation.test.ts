import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceEditableBlockSource, splitEditableMarkdownDocument } from '../src/utils/wysiwyg/blocks.ts';

test('WYSIWYG 修改一个块时逐字保留其他块和 CRLF', () => {
  const source = '\uFEFF---\r\ntitle: 保留\r\n---\r\n# 标题\r\n\r\n* 列表甲\r\n* 列表乙\r\n\r\n需要修改的段落。\r\n\r\n结尾 `原样`。\r\n';
  const document = splitEditableMarkdownDocument(source);
  const paragraph = document.blocks.find(block => block.kind === 'paragraph' && block.source.includes('需要修改'));
  assert.ok(paragraph);
  const updated = replaceEditableBlockSource(document, paragraph, '已经修改的段落。\r\n');
  assert.ok(updated.source.startsWith('\uFEFF---\r\ntitle: 保留\r\n---\r\n# 标题\r\n\r\n* 列表甲\r\n* 列表乙\r\n\r\n'));
  assert.ok(updated.source.endsWith('\r\n\r\n结尾 `原样`。\r\n'));
  assert.equal(updated.source.replace(/\r\n/g, '').includes('\n'), false);
});

test('结构修改后重新分块但不重写未修改的源码片段', () => {
  const source = '- 甲\n- 乙\n\n普通段落\n\n> 引用\n> 第二行\n';
  const document = splitEditableMarkdownDocument(source);
  const list = document.blocks.find(block => block.kind === 'list');
  assert.ok(list);
  const updated = replaceEditableBlockSource(document, list, '- 甲\n- 乙\n- 丙');
  assert.ok(updated.source.includes('\n\n普通段落\n\n> 引用\n> 第二行\n'));
  assert.ok(updated.source.startsWith('- 甲\n- 乙\n- 丙\n'));
});
