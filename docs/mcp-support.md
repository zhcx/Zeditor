# MCP 集成完整指南

Zeditor 内置 MCP（Model Context Protocol）服务器，让外部 AI 助手读取、创建、保存和切换你正在编辑的文档。支持 **Claude Desktop、Claude Code、Codex CLI、Gemini CLI、Pi Agent、DeepSeek Harness、WorkBuddy、Qoder / Qoder CN**，也支持任何兼容标准 `mcpServers` JSON 的 Harness。

> MCP 集成仅适用于 Zeditor 桌面版。桥接只监听 `127.0.0.1`，使用每次启动生成的随机令牌，不对外开放网络端口。

## 1. 工作原理

```text
AI 助手 / Harness
  └─ stdio + 换行 JSON-RPC
      └─ zeditor_mcp_server
          └─ WebSocket 127.0.0.1 + 随机令牌
              └─ Zeditor 桥接
                  └─ 前端执行工具并返回结果
```

Zeditor 负责编辑器内的实际动作；MCP sidecar 负责标准协议。客户端配置只保存 `zeditor_mcp_server` 的本地路径，不需要在助手中填写端口或令牌。

## 2. 快速开始

1. 打开 **设置 → 集成**，开启「启用 MCP 服务器」。总开关会立即启动或断开桥接。
2. 点击 **测试 MCP 连接**。Zeditor 会启动 sidecar，完成 `initialize` 和 `tools/list` 握手。
3. 在 **AI 助手配置** 中搜索目标客户端，点击 **安装**。
4. 完全退出并重启客户端，或执行客户端提供的 MCP 重载命令。
5. 先让助手执行一个只读请求，例如「列出 Zeditor 当前打开的标签页」。

「启动时自动运行」控制 Zeditor 下次启动是否自动开启桥接；「自动批准编辑」默认关闭，AI 写入仍会进入内联审阅。

## 3. 一键配置与安全写入

设置 → 集成 → AI 助手配置提供以下操作：

- **安装 / 修复**：解析现有配置，只更新 `zeditor` 条目，保留其它助手与设置。
- **复制配置**：复制当前 sidecar 路径对应的 JSON、TOML 或 YAML，供手动配置使用。
- **测试 MCP 连接**：验证 sidecar 能否启动、完成协议握手并返回工具列表。
- **状态**：区分未安装、已安装、路径不匹配和配置解析失败。

写入策略：

- JSON、TOML、YAML 必须先成功解析，损坏文件不会被覆盖。
- 写入前在原文件同目录生成 `*.zeditor-backup` 备份。
- 临时文件写入后通过重命名替换，避免留下半截配置。
- Codex 的旧 `[mcp_servers.zeditor]` 条目会被原位修复，并保留注释。
- DeepSeek Harness 使用 Cordis patch 列表，只替换 `id: zeditor` 的条目。

## 4. 支持的客户端

下表中 `H` 在 Windows 表示 `%USERPROFILE%`，在 macOS / Linux 表示 `~`。

| 客户端 | 用户级配置 | 格式 | 生效方式 |
| --- | --- | --- | --- |
| Claude Desktop | Windows：`%APPDATA%\Claude\claude_desktop_config.json`；macOS：`H/Library/Application Support/Claude/claude_desktop_config.json`；Linux：`H/.config/Claude/claude_desktop_config.json` | JSON | 完全退出并重启 |
| Claude Code | `H/.claude.json` | JSON | 重启 Claude Code |
| Codex CLI | `H/.codex/config.toml` | TOML | 重启 Codex |
| Gemini CLI | `H/.gemini/settings.json` | JSON | 重启 Gemini CLI |
| Pi Agent | `H/.pi/agent/mcp.json`；项目级 `<项目>/.pi/mcp.json` | JSON | 会话外执行 `/reload` |
| DeepSeek Harness | `$DSH_HOME/cordis.patch.yml`，默认 `H/.dsh/cordis.patch.yml`；profile 使用 `$DSH_HOME/profiles/<name>/cordis.patch.yml` | YAML | 重载配置或新建会话 |
| WorkBuddy | `H/.workbuddy/mcp.json`；项目级 `<项目>/.workbuddy/mcp.json` | JSON | 5.6.0+ 保存后即时生效 |
| Qoder | `H/.qoder/settings.json`；支持 `QODER_CONFIG_DIR` | JSON | `/mcp reload`，部分设置需重启 |
| Qoder CN | `H/.qoder-cn/settings.json`；支持 `QODER_CN_CONFIG_DIR` | JSON | `/mcp reload`，部分设置需重启 |
| 通用 Harness | 由客户端文档决定 | 通常 JSON | 按客户端要求重载或重启 |

Pi Agent 与 DeepSeek Harness 也已在 Zeditor 的本地 Agent 功能中支持；这里的客户端配置用于让它们作为 **MCP 客户端** 连接 Zeditor，两者互不替代。

## 5. 手动配置

推荐优先使用设置页的「复制配置」，避免 Windows 路径转义错误。下面示例中的路径必须替换成你电脑上的实际路径。

### 5.1 标准 JSON：Claude、Gemini、Pi、WorkBuddy、Qoder

将下面条目合并到配置文件的 `mcpServers` 对象中，不要覆盖整个文件：

```json
{
  "mcpServers": {
    "zeditor": {
      "command": "C:\\Program Files\\Zeditor\\zeditor_mcp_server.exe",
      "args": []
    }
  }
}
```

macOS / Linux 示例：

```json
{
  "mcpServers": {
    "zeditor": {
      "command": "/Applications/Zeditor.app/Contents/MacOS/zeditor_mcp_server",
      "args": []
    }
  }
}
```

Qoder 还支持项目级 `.mcp.json`、`.qoder/settings.json` 和 `.qoder/settings.local.json`。用户级设置使用顶层 `mcpServers`；`command` 与 `url` 只能选择其一。Zeditor 使用本地 stdio，因此配置 `command`。

### 5.2 Codex CLI：TOML

```toml
[mcp_servers.zeditor]
command = "C:\\Program Files\\Zeditor\\zeditor_mcp_server.exe"
args = []
```

如果已有 `[mcp_servers.zeditor]`，只更新该表的 `command` 和 `args`，保留其它表与注释。

### 5.3 DeepSeek Harness：Cordis YAML patch

DeepSeek Harness 不使用 `mcpServers` JSON，而是 Cordis patch：

```yaml
- insert:
    - id: zeditor
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: zeditor
        transport: stdio
        command: "C:\\Program Files\\Zeditor\\zeditor_mcp_server.exe"
        args: []
        env: {}
```

Windows 路径建议直接使用设置页生成的 YAML。profile 配置写入对应的 `profiles/<name>/cordis.patch.yml`。

### 5.4 Pi Agent

用户级配置：

```json
{
  "mcpServers": {
    "zeditor": {
      "command": "/absolute/path/to/zeditor_mcp_server",
      "args": [],
      "env": {},
      "cwd": "/absolute/working/directory"
    }
  }
}
```

Pi 支持 stdio 与 Streamable HTTP，不支持旧 SSE。Zeditor 使用 stdio。修改配置后执行 `/reload`。项目级 `<项目>/.pi/mcp.json` 需要先信任项目。

### 5.5 WorkBuddy

```json
{
  "mcpServers": {
    "zeditor": {
      "command": "C:\\Program Files\\Zeditor\\zeditor_mcp_server.exe",
      "args": [],
      "env": {},
      "timeout": 60000
    }
  }
}
```

WorkBuddy 5.6.0+ 直接保存 `mcp.json` 后即时生效；旧版本请完全重启。项目级配置位于 `<项目>/.workbuddy/mcp.json`。

## 6. 列表外 Harness 的通用连接流程

如果客户端没有出现在设置页列表中，按以下步骤操作：

1. **确认协议**：客户端必须支持 MCP stdio，并能配置 `command` 与字符串数组 `args`。如果只支持远程 SSE / HTTP，不能直接连接 Zeditor 的本地 sidecar。
2. **找到配置文件**：查阅客户端官方文档，定位用户级或项目级 MCP 配置。不要猜测文件名。
3. **复制 Zeditor 配置**：设置 → 集成 → 通用 Harness → 复制配置。
4. **合并条目**：将 `mcpServers.zeditor` 合并到客户端要求的结构中。若客户端使用不同键名，如 `mcp_servers`，只调整外层键，保持 `command` / `args` 不变。
5. **使用绝对路径**：`command` 必须是可执行文件路径，不能写成 shell 命令，也不要使用 `cd ... && ...`。
6. **处理空格与转义**：JSON 中 Windows 反斜杠写成 `\\`；优先使用设置页复制出的配置。
7. **避免明文密钥**：Zeditor 本地 stdio 不需要 API Key。其它服务密钥使用客户端支持的 `${ENV_VAR}` 或凭据管理机制。
8. **重载或重启**：按客户端文档执行 MCP reload；没有重载命令时完全退出并重启。
9. **只读验证**：先执行「列出标签页」或「读取当前文档」，确认工具出现且账号 / 工作区范围正确。
10. **再开放写入**：确认读路径无误后，再测试保存；保持 Zeditor 的「自动批准编辑」关闭，直到你信任该客户端。

### 通用 JSON 模板

```json
{
  "mcpServers": {
    "zeditor": {
      "command": "/absolute/path/to/zeditor_mcp_server",
      "args": []
    }
  }
}
```

### 客户端使用不同外层键时

```json
{
  "mcp_servers": {
    "zeditor": {
      "command": "/absolute/path/to/zeditor_mcp_server",
      "args": []
    }
  }
}
```

### 使用 TOML 的客户端

```toml
[mcp_servers.zeditor]
command = "/absolute/path/to/zeditor_mcp_server"
args = []
```

### 使用 YAML patch 的客户端

参考 DeepSeek Harness 的 Cordis patch 结构；关键是保留客户端要求的 patch 类型，只替换 Zeditor 对应条目。

## 7. 与 AI 助手协作

重启或重载后，助手会自动发现 Zeditor 工具。示例：

- 「列出 Zeditor 当前打开的标签页」
- 「读取当前文档并总结要点」
- 「把选中段落改得更简洁，先给我看差异」
- 「在文档末尾追加一段结论」
- 「新建一个文档，标题为《周报》」

默认未开启自动批准时，写入会进入 **AI 修改建议** 内联差异，可逐条接受、拒绝或撤销。`document_write` 使用修订号防止覆盖：如果助手读取后你又修改了文档，写入会返回 `STALE`，助手需要重新读取。

## 8. 可用工具

| 工具 | 作用 |
| --- | --- |
| `session_get_state` | 读取当前会话、标签页和活动文档 |
| `workspace_new` | 新建文档 |
| `workspace_open` | 打开工作区内的文件 |
| `workspace_save` | 保存当前文档 |
| `workspace_save_as` | 另存为 |
| `workspace_close` | 关闭标签页 |
| `workspace_switch_tab` | 切换活动标签页 |
| `document_read` | 读取内容与修订号 |
| `document_write` | 写入内容，支持 `expected_revision` |
| `selection_get` | 获取当前选区 |
| `selection_set` | 设置当前选区 |

## 9. 安全边界

- **仅本机**：WebSocket 只绑定 `127.0.0.1`。
- **随机令牌**：每次 Zeditor 启动重新生成，首帧认证失败立即断开。
- **路径受限**：文件工具限制在已打开的工作区根目录与文档目录内。
- **人工审阅**：默认修改不直接落盘。
- **配置备份**：安装 / 修复前生成 `*.zeditor-backup`。
- **随时断开**：关闭 MCP 总开关或点击「停止桥接」立即生效。

## 10. 故障排查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 测试连接超时 | 桥接未启动或 sidecar 缺失 | 先启动桥接；检查安装目录是否存在 `zeditor_mcp_server` |
| 助手看不到工具 | 配置后未重载 / 重启 | 按客户端要求执行 `/reload`、`/mcp reload` 或完全重启 |
| 路径不匹配 | Zeditor 更新后安装路径变化 | 设置 → 集成 → 重新点击「修复」 |
| 配置解析失败 | 原文件 JSON / TOML / YAML 损坏 | 先修复原文件；Zeditor 不会覆盖损坏配置，可从 `*.zeditor-backup` 恢复 |
| Pi 不加载 | 修改后未 `/reload` | 在 Pi 中执行 `/reload` |
| DeepSeek Harness 不加载 | patch 未写入正确 profile | 检查 `$DSH_HOME` 和 `profiles/<name>/cordis.patch.yml` |
| Qoder 不加载 | 国际版 / CN 版目录混淆 | 国际版检查 `~/.qoder/settings.json`，CN 版检查 `~/.qoder-cn/settings.json` |
| Windows 启动失败 | 路径转义错误或命令不是绝对路径 | 使用设置页「复制配置」，不要手写 `cd &&` |
| 写入返回 `STALE` | 文档在读取后被修改 | 让助手重新读取后再写 |
| 写入返回 `INVALID_PATH` | 目标不在允许目录 | 先在 Zeditor 打开对应工作区或文档目录 |

自检日志不会输出令牌。如果仍需排查，请仅提供脱敏后的错误信息，不要分享 `mcp_bridge.json`。

## 11. 官方参考

- [Pi MCP 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md)
- [DeepSeek Harness MCP 指南](https://deepseek-harness.github.io/deepseek-harness/guide/mcp-memory)
- [DeepSeek Harness 配置参考](https://deepseek-harness.github.io/deepseek-harness/reference/config-catalog)
- [WorkBuddy MCP 指南](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)
- [WorkBuddy 连接器规范](https://open.workbuddy.cn/docs/connector)
- [Qoder Desktop Connectors](https://docs.qoder.com/qoder/connectors)
- [Qoder CLI MCP 参考](https://docs.qoder.com/zh/cli/mcp-reference)
- [Claude Desktop MCP 文档](https://modelcontextprotocol.io/quickstart/user)
- [Codex MCP 文档](https://developers.openai.com/codex/mcp/)
- [Gemini CLI MCP 文档](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md)

查证日期：2026-11-28。客户端配置可能随版本变化；一键安装以当前 Zeditor 注册表为准，手动配置以客户端官方文档为准。
