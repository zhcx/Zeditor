---
title: MCP 集成
---

# MCP 集成

Zeditor 内置 MCP 服务器，让外部 AI 助手通过 stdio 读写当前文档。支持 Claude Desktop、Claude Code、Codex CLI、Gemini CLI、Pi Agent、DeepSeek Harness、WorkBuddy、Qoder / Qoder CN，以及兼容标准 `mcpServers` 的通用 Harness。

## 三步启用

1. `设置 → 集成`，开启「**启用 MCP 服务器**」；总开关会立即启动或断开桥接。
2. 点击「**测试 MCP 连接**」，确认 sidecar 完成 `initialize` 与 `tools/list` 握手。
3. 在「AI 助手配置」搜索目标客户端，点击「**安装**」，然后按客户端要求重启或执行 `/reload` / `/mcp reload`。

设置页也支持「复制配置」、路径修复和损坏配置保护。安装 / 修复前会自动生成 `*.zeditor-backup`。

## 提供的工具

| 工具 | 作用 |
| --- | --- |
| `session_get_state` | 获取会话、标签页与活动文档 |
| `workspace_new` / `workspace_open` / `workspace_close` | 新建 / 打开 / 关闭文档 |
| `workspace_save` / `workspace_save_as` | 保存 / 另存 |
| `workspace_switch_tab` | 切换标签页 |
| `document_read` | 读取内容与修订号 |
| `document_write` | 写入内容，过期修订返回 `STALE` |
| `selection_get` / `selection_set` | 读取 / 设置选区 |

## 安全边界

- 桥接仅监听 `127.0.0.1`，使用随机令牌认证。
- 文件操作限定在已打开的工作区根与文档目录内。
- 默认修改进入内联审阅；「自动批准编辑」仅在完全信任客户端时开启。
- 状态栏 MCP 指示灯：灰 = 未运行，绿 = 运行中等待连接，脉冲绿 = 已连接。

## 一键配置的客户端

| 客户端 | 用户级配置 |
| --- | --- |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` / macOS Application Support / Linux `.config/Claude` |
| Claude Code | `~/.claude.json` |
| Codex CLI | `~/.codex/config.toml` |
| Gemini CLI | `~/.gemini/settings.json` |
| Pi Agent | `~/.pi/agent/mcp.json` |
| DeepSeek Harness | `$DSH_HOME/cordis.patch.yml`，默认 `~/.dsh/cordis.patch.yml` |
| WorkBuddy | `~/.workbuddy/mcp.json` |
| Qoder | `~/.qoder/settings.json` |
| Qoder CN | `~/.qoder-cn/settings.json` |

## 下一步

- [MCP 集成完整指南](/mcp-support) —— 手动 JSON / TOML / YAML、通用 Harness 接入、安全与故障排查
- [本地 Agent](/guide/ai/agent) —— Zeditor 内直接驱动 CLI Agent
