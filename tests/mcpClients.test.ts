import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

test('MCP 设置列出新增 Harness 与通用客户端', () => {
  const settings = read('src/components/Settings/SettingsPanel.tsx');
  for (const client of ['pi', 'deepseek_harness', 'workbuddy', 'qoder', 'qoder_cn', 'generic']) {
    assert.match(settings, new RegExp(`${client}:`));
  }
  assert.match(settings, /mcp_probe_server/);
  assert.match(settings, /搜索 AI 助手/);
  assert.match(settings, /复制配置/);
  assert.match(settings, /损坏配置不会被覆盖/);
});

test('MCP 总开关立即同步桥接状态', () => {
  const settings = read('src/components/Settings/SettingsPanel.tsx');
  assert.match(settings, /const applyMcpSetting/);
  assert.match(settings, /applyMcpSetting\(\{ enabled: checked \}\)/);
  assert.match(settings, /mcp_bridge_set_enabled/);
});

test('MCP 客户端注册表覆盖 JSON、TOML、YAML 与跨平台路径', () => {
  const rust = read('src-tauri/src/mcp/clients.rs');
  for (const id of ['claude_desktop', 'claude_code', 'codex', 'gemini', 'pi', 'deepseek_harness', 'workbuddy', 'qoder', 'qoder_cn', 'generic']) {
    assert.match(rust, new RegExp(`id: "${id}"`));
  }
  for (const env of ['PI_CODING_AGENT_DIR', 'DSH_HOME', 'QODER_CONFIG_DIR', 'QODER_CN_CONFIG_DIR']) assert.match(rust, new RegExp(env));
  assert.match(rust, /ClientConfigFormat::Yaml/);
  assert.match(rust, /write_config_atomic/);
  assert.match(rust, /拒绝覆盖损坏的 JSON/);
  assert.match(read('src-tauri/src/main.rs'), /mcp::clients::mcp_probe_server/);
});

test('MCP 完整指南覆盖新增 Harness 与列表外接入流程', () => {
  const guide = read('docs/mcp-support.md');
  for (const label of ['Pi Agent', 'DeepSeek Harness', 'WorkBuddy', 'Qoder CN', '通用 Harness', 'Cordis', 'mcp_servers.zeditor', 'STALE', 'INVALID_PATH']) {
    assert.ok(guide.includes(label), `${label} 未出现在 MCP 指南`);
  }
  assert.match(guide, /列表外 Harness 的通用连接流程/);
  assert.match(guide, /官方参考/);
});
