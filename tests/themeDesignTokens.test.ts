import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES } from '../src/themes/index.ts';
import { contrastRatio, parseHex, readableForeground } from '../src/themes/colorTokens.ts';

const rgb = (value: string) => {
  const color = parseHex(value);
  assert.ok(color, ` expected hex colour, received ${value}`);
  return color;
};

test('保留 12 套主题 ID、名称与明暗分组', () => {
  assert.deepEqual(THEMES.map(theme => theme.id), [
    'vscode-light', 'elegant-light', 'notion-light', 'writer-light', 'bear-light', 'sepia-light',
    'vscode-dark', 'gruvbox-dark', 'midnight-dark', 'solarized-dark', 'nord-dark', 'dracula-dark',
  ]);
  assert.equal(THEMES.filter(theme => theme.mode === 'light').length, 6);
  assert.equal(THEMES.filter(theme => theme.mode === 'dark').length, 6);
});

test('旗舰浅色与深色主题使用指定的 Zeditor 语义配色', () => {
  const light = THEMES.find(theme => theme.id === 'vscode-light')!.vars;
  const dark = THEMES.find(theme => theme.id === 'vscode-dark')!.vars;
  assert.equal(light['bg-app'], '#f7f8fa');
  assert.equal(light['bg-panel'], '#eef1f5');
  assert.equal(light['bg-document'], '#ffffff');
  assert.equal(light['brand-color'], '#173e7a');
  assert.equal(light['accent-color'], '#356ae6');
  assert.equal(light['text-primary'], '#202938');
  assert.equal(light['text-secondary'], '#667085');
  assert.equal(light['text-muted'], '#98a2b3');
  assert.equal(light['border'], '#e2e6ed');
  assert.equal(dark['bg-app'], '#171b22');
  assert.equal(dark['bg-panel'], '#1d232d');
  assert.equal(dark['bg-document'], '#202733');
  assert.equal(dark['accent-color'], '#6ea8fe');
  assert.equal(dark['text-primary'], '#e6ebf2');
  assert.equal(dark['text-secondary'], '#a0aaba');
  assert.equal(dark['border'], '#303947');
});

test('所有主题的实心强调按钮前景色达到 AA 对比度', () => {
  for (const theme of THEMES) {
    const accent = theme.vars['accent-solid'];
    const foreground = theme.vars['on-accent'];
    assert.equal(foreground, readableForeground(accent), `${theme.id} 应选择最佳前景色`);
    assert.ok(contrastRatio(rgb(accent), rgb(foreground)) >= 4.5, `${theme.id} 主按钮对比度不足`);
  }
});

test('所有主题的强调文字和状态文字在文档表面可读', () => {
  for (const theme of THEMES) {
    const surface = theme.vars['bg-document'];
    for (const token of ['accent-text', 'success-text', 'warning-text', 'danger-text']) {
      assert.ok(contrastRatio(rgb(theme.vars[token]), rgb(surface)) >= 4.5, `${theme.id} ${token} 对比度不足`);
    }
  }
});

test('所有主题的 UI 次级与弱化文字在侧栏表面达到 AA', () => {
  for (const theme of THEMES) {
    const surface = theme.vars['bg-panel'];
    for (const token of ['secondary-text', 'muted-text']) {
      assert.ok(contrastRatio(rgb(theme.vars[token]), rgb(surface)) >= 4.5, `${theme.id} ${token} 对比度不足`);
    }
  }
});
