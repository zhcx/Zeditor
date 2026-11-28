//! MCP client configuration registry.
//!
//! Configuration files are user-owned. Install / repair operations parse the
//! existing file, preserve unrelated entries, create a backup and swap a temp
//! file into place. Malformed files are reported instead of overwritten.

use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};
use serde_yaml::Value as YamlValue;
use toml_edit::{Document, Item, Table};

use super::resolve_mcp_server_path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ClientConfigFormat {
    Json,
    Toml,
    Yaml,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ClientConfigStatus {
    pub client: String,
    pub label: String,
    pub format: ClientConfigFormat,
    pub transport: &'static str,
    pub configured: bool,
    pub path_mismatch: bool,
    pub path: String,
    pub snippet: String,
    pub note: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy)]
struct ClientDefinition {
    id: &'static str,
    label: &'static str,
    format: ClientConfigFormat,
    path: fn() -> Option<PathBuf>,
    note: &'static str,
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
}

fn xdg_config_dir() -> Option<PathBuf> {
    std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| home_dir().map(|home| home.join(".config")))
}

fn claude_desktop_path() -> Option<PathBuf> {
    if cfg!(windows) {
        std::env::var_os("APPDATA").map(|root| {
            PathBuf::from(root)
                .join("Claude")
                .join("claude_desktop_config.json")
        })
    } else if cfg!(target_os = "macos") {
        home_dir()
            .map(|home| home.join("Library/Application Support/Claude/claude_desktop_config.json"))
    } else {
        xdg_config_dir().map(|root| root.join("Claude/claude_desktop_config.json"))
    }
}

fn claude_code_path() -> Option<PathBuf> {
    home_dir().map(|home| home.join(".claude.json"))
}

fn codex_path() -> Option<PathBuf> {
    home_dir().map(|home| home.join(".codex/config.toml"))
}

fn gemini_path() -> Option<PathBuf> {
    home_dir().map(|home| home.join(".gemini/settings.json"))
}

fn pi_path() -> Option<PathBuf> {
    std::env::var_os("PI_CODING_AGENT_DIR")
        .map(PathBuf::from)
        .or_else(|| home_dir().map(|home| home.join(".pi/agent")))
        .map(|root| root.join("mcp.json"))
}

fn deepseek_path() -> Option<PathBuf> {
    std::env::var_os("DSH_HOME")
        .map(PathBuf::from)
        .or_else(|| home_dir().map(|home| home.join(".dsh")))
        .map(|root| root.join("cordis.patch.yml"))
}

fn workbuddy_path() -> Option<PathBuf> {
    home_dir().map(|home| home.join(".workbuddy/mcp.json"))
}

fn qoder_path() -> Option<PathBuf> {
    std::env::var_os("QODER_CONFIG_DIR")
        .map(PathBuf::from)
        .or_else(|| home_dir().map(|home| home.join(".qoder")))
        .map(|root| root.join("settings.json"))
}

fn qoder_cn_path() -> Option<PathBuf> {
    std::env::var_os("QODER_CN_CONFIG_DIR")
        .map(PathBuf::from)
        .or_else(|| home_dir().map(|home| home.join(".qoder-cn")))
        .map(|root| root.join("settings.json"))
}

fn generic_path() -> Option<PathBuf> {
    None
}

const CLIENTS: &[ClientDefinition] = &[
    ClientDefinition {
        id: "claude_desktop",
        label: "Claude Desktop",
        format: ClientConfigFormat::Json,
        path: claude_desktop_path,
        note: "安装后完全退出并重启 Claude Desktop。",
    },
    ClientDefinition {
        id: "claude_code",
        label: "Claude Code",
        format: ClientConfigFormat::Json,
        path: claude_code_path,
        note: "安装后重启 Claude Code，并确认工作区已加载 MCP 工具。",
    },
    ClientDefinition {
        id: "codex",
        label: "Codex CLI",
        format: ClientConfigFormat::Toml,
        path: codex_path,
        note: "保留现有 TOML 注释与其它 MCP 配置；安装后重启 Codex。",
    },
    ClientDefinition {
        id: "gemini",
        label: "Gemini CLI",
        format: ClientConfigFormat::Json,
        path: gemini_path,
        note: "安装后重启 Gemini CLI。",
    },
    ClientDefinition {
        id: "pi",
        label: "Pi Agent",
        format: ClientConfigFormat::Json,
        path: pi_path,
        note: "会话外执行 /reload；项目级配置位于 <项目>/.pi/mcp.json。",
    },
    ClientDefinition {
        id: "deepseek_harness",
        label: "DeepSeek Harness",
        format: ClientConfigFormat::Yaml,
        path: deepseek_path,
        note: "写入 Cordis patch；重新加载配置或新建会话后生效。",
    },
    ClientDefinition {
        id: "workbuddy",
        label: "WorkBuddy",
        format: ClientConfigFormat::Json,
        path: workbuddy_path,
        note: "WorkBuddy 5.6.0+ 保存 mcp.json 后即时生效。",
    },
    ClientDefinition {
        id: "qoder",
        label: "Qoder",
        format: ClientConfigFormat::Json,
        path: qoder_path,
        note: "运行中执行 /mcp reload；部分设置项需重启 Qoder。",
    },
    ClientDefinition {
        id: "qoder_cn",
        label: "Qoder CN",
        format: ClientConfigFormat::Json,
        path: qoder_cn_path,
        note: "写入 ~/.qoder-cn/settings.json；运行中执行 /mcp reload。",
    },
    ClientDefinition {
        id: "generic",
        label: "通用 Harness",
        format: ClientConfigFormat::Json,
        path: generic_path,
        note: "复制标准 mcpServers JSON，按客户端文档粘贴到对应配置。",
    },
];

fn find_client(client: &str) -> Option<&'static ClientDefinition> {
    CLIENTS.iter().find(|definition| definition.id == client)
}

fn path_is_same(first: &Path, second: &Path) -> bool {
    if let (Ok(left), Ok(right)) = (first.canonicalize(), second.canonicalize()) {
        return left == right;
    }
    let normalize = |path: &Path| {
        let value = path.to_string_lossy().replace('\\', "/");
        if cfg!(windows) {
            value.to_lowercase()
        } else {
            value
        }
    };
    normalize(first) == normalize(second)
}

fn configured_command(format: ClientConfigFormat, text: &str) -> Result<Option<String>, String> {
    match format {
        ClientConfigFormat::Json => {
            let root: Value =
                serde_json::from_str(text).map_err(|error| format!("JSON 解析失败：{error}"))?;
            Ok(root
                .pointer("/mcpServers/zeditor/command")
                .and_then(Value::as_str)
                .map(str::to_string))
        }
        ClientConfigFormat::Toml => {
            let document: Document = text
                .parse()
                .map_err(|error| format!("TOML 解析失败：{error}"))?;
            Ok(document
                .get("mcp_servers")
                .and_then(Item::as_table)
                .and_then(|table| table.get("zeditor"))
                .and_then(Item::as_table)
                .and_then(|table| table.get("command"))
                .and_then(Item::as_str)
                .map(str::to_string))
        }
        ClientConfigFormat::Yaml => {
            let root: YamlValue =
                serde_yaml::from_str(text).map_err(|error| format!("YAML 解析失败：{error}"))?;
            Ok(root.as_sequence().and_then(|items| {
                items.iter().find_map(|item| {
                    item.get("insert")?
                        .as_sequence()?
                        .iter()
                        .find(|entry| {
                            entry.get("id").and_then(YamlValue::as_str) == Some("zeditor")
                        })
                        .and_then(|entry| entry.get("config"))
                        .and_then(|config| config.get("command"))
                        .and_then(YamlValue::as_str)
                        .map(str::to_string)
                })
            }))
        }
    }
}

fn inspect_config(
    format: ClientConfigFormat,
    text: &str,
    binary: Option<&Path>,
) -> (bool, bool, Option<String>) {
    if text.trim().is_empty() {
        return (false, false, None);
    }
    match configured_command(format, text) {
        Ok(Some(command)) => {
            let mismatch = binary
                .map(|expected| !path_is_same(Path::new(&command), expected))
                .unwrap_or(false);
            (true, mismatch, None)
        }
        Ok(None) => (false, false, None),
        Err(error) => (false, false, Some(error)),
    }
}

fn upsert_json(text: &str, binary: &Path) -> Result<String, String> {
    let mut root: Value = if text.trim().is_empty() {
        json!({})
    } else {
        serde_json::from_str(text).map_err(|error| format!("拒绝覆盖损坏的 JSON 配置：{error}"))?
    };
    let root_object = root
        .as_object_mut()
        .ok_or_else(|| "配置文件根节点不是 JSON 对象".to_string())?;
    let servers = root_object.entry("mcpServers").or_insert_with(|| json!({}));
    let servers = servers
        .as_object_mut()
        .ok_or_else(|| "mcpServers 不是 JSON 对象".to_string())?;
    servers.insert(
        "zeditor".to_string(),
        json!({
            "command": binary.to_string_lossy(),
            "args": [],
        }),
    );
    Ok(format!(
        "{}\n",
        serde_json::to_string_pretty(&root).map_err(|error| error.to_string())?
    ))
}

fn ensure_table<'a>(table: &'a mut Table, key: &str) -> Result<&'a mut Table, String> {
    if !table.get(key).map(Item::is_table).unwrap_or(false) {
        table.insert(key, Item::Table(Table::new()));
    }
    table
        .get_mut(key)
        .and_then(Item::as_table_mut)
        .ok_or_else(|| format!("TOML 配置项 {key} 不是表"))
}

fn upsert_toml(text: &str, binary: &Path) -> Result<String, String> {
    let mut document: Document = if text.trim().is_empty() {
        Document::new()
    } else {
        text.parse()
            .map_err(|error| format!("拒绝覆盖损坏的 TOML 配置：{error}"))?
    };
    let servers = ensure_table(&mut document, "mcp_servers")?;
    let zeditor = ensure_table(servers, "zeditor")?;
    zeditor.insert(
        "command",
        toml_edit::value(binary.to_string_lossy().to_string()),
    );
    zeditor.insert("args", toml_edit::value(toml_edit::Array::new()));
    Ok(document.to_string())
}

fn deepseek_entry(binary: &Path) -> Result<YamlValue, String> {
    serde_yaml::to_value(json!({
        "id": "zeditor",
        "name": "@deepseek-ai/dsh-mcp-client",
        "config": {
            "serverName": "zeditor",
            "transport": "stdio",
            "command": binary.to_string_lossy(),
            "args": [],
            "env": {},
        },
    }))
    .map_err(|error| error.to_string())
}

fn upsert_yaml(text: &str, binary: &Path) -> Result<String, String> {
    let mut root: YamlValue = if text.trim().is_empty() {
        YamlValue::Sequence(Vec::new())
    } else {
        serde_yaml::from_str(text).map_err(|error| format!("拒绝覆盖损坏的 YAML 配置：{error}"))?
    };
    let items = root
        .as_sequence_mut()
        .ok_or_else(|| "DeepSeek Harness cordis.patch.yml 根节点不是列表".to_string())?;
    let entry = deepseek_entry(binary)?;
    let mut replaced = false;
    for item in items.iter_mut() {
        let Some(inserts) = item.get_mut("insert").and_then(YamlValue::as_sequence_mut) else {
            continue;
        };
        for existing in inserts.iter_mut() {
            if existing.get("id").and_then(YamlValue::as_str) == Some("zeditor") {
                *existing = entry.clone();
                replaced = true;
            }
        }
    }
    if !replaced {
        items.push(
            serde_yaml::to_value(json!({ "insert": [entry] }))
                .map_err(|error| error.to_string())?,
        );
    }
    serde_yaml::to_string(&root).map_err(|error| error.to_string())
}

fn upsert_config(format: ClientConfigFormat, text: &str, binary: &Path) -> Result<String, String> {
    match format {
        ClientConfigFormat::Json => upsert_json(text, binary),
        ClientConfigFormat::Toml => upsert_toml(text, binary),
        ClientConfigFormat::Yaml => upsert_yaml(text, binary),
    }
}

fn config_snippet(format: ClientConfigFormat, binary: &Path) -> String {
    upsert_config(format, "", binary).unwrap_or_default()
}

#[cfg(unix)]
fn set_new_file_permissions(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn set_new_file_permissions(_path: &Path) {}

fn write_config_atomic(path: &Path, content: &str) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "配置路径没有父目录".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let file_name = path
        .file_name()
        .ok_or_else(|| "配置路径没有文件名".to_string())?
        .to_string_lossy();
    let temporary = parent.join(format!(".{file_name}.{}.tmp", uuid::Uuid::new_v4()));
    let backup = parent.join(format!("{file_name}.zeditor-backup"));
    fs::write(&temporary, content).map_err(|error| error.to_string())?;
    if let Ok(metadata) = fs::metadata(path) {
        let _ = fs::set_permissions(&temporary, metadata.permissions());
    } else {
        set_new_file_permissions(&temporary);
    }

    let had_original = path.exists();
    if had_original {
        if backup.exists() {
            fs::remove_file(&backup).map_err(|error| error.to_string())?;
        }
        fs::rename(path, &backup).map_err(|error| format!("备份原配置失败：{error}"))?;
    }
    if let Err(error) = fs::rename(&temporary, path) {
        if had_original && backup.exists() {
            let _ = fs::rename(&backup, path);
        }
        let _ = fs::remove_file(&temporary);
        return Err(format!("写入配置失败：{error}"));
    }
    Ok(backup)
}

fn status_for(
    definition: &ClientDefinition,
    binary: Option<&Path>,
) -> Result<ClientConfigStatus, String> {
    let path = (definition.path)().ok_or_else(|| "无法定位该助手的配置目录".to_string())?;
    let text = fs::read_to_string(&path).unwrap_or_default();
    let (configured, path_mismatch, error) = inspect_config(definition.format, &text, binary);
    Ok(ClientConfigStatus {
        client: definition.id.to_string(),
        label: definition.label.to_string(),
        format: definition.format,
        transport: "stdio",
        configured,
        path_mismatch,
        path: path.to_string_lossy().into_owned(),
        snippet: binary
            .map(|binary| config_snippet(definition.format, binary))
            .unwrap_or_default(),
        note: definition.note.to_string(),
        error,
    })
}

/// 为指定 AI 助手写入或修复 MCP 配置。
#[tauri::command]
pub async fn mcp_install_client_config(client: String) -> Result<ClientConfigStatus, String> {
    let definition = find_client(&client).ok_or_else(|| format!("不支持的 AI 助手：{client}"))?;
    if definition.id == "generic" {
        return Err("通用 Harness 请复制标准 mcpServers 配置".to_string());
    }
    let binary = resolve_mcp_server_path()?;
    let path = (definition.path)().ok_or_else(|| "无法定位该助手的配置目录".to_string())?;
    let existing = fs::read_to_string(&path).unwrap_or_default();
    let content = upsert_config(definition.format, &existing, &binary)?;
    write_config_atomic(&path, &content)?;
    status_for(definition, Some(&binary))
}

/// 各 AI 助手的安装状态与可复制配置。
#[tauri::command]
pub async fn mcp_client_config_status() -> Result<Vec<ClientConfigStatus>, String> {
    let binary = resolve_mcp_server_path().ok();
    let mut statuses = Vec::new();
    for definition in CLIENTS {
        if definition.id == "generic" {
            statuses.push(ClientConfigStatus {
                client: definition.id.to_string(),
                label: definition.label.to_string(),
                format: definition.format,
                transport: "stdio",
                configured: false,
                path_mismatch: false,
                path: String::new(),
                snippet: binary
                    .as_deref()
                    .map(|binary| config_snippet(definition.format, binary))
                    .unwrap_or_default(),
                note: definition.note.to_string(),
                error: None,
            });
            continue;
        }
        match status_for(definition, binary.as_deref()) {
            Ok(status) => statuses.push(status),
            Err(error) => statuses.push(ClientConfigStatus {
                client: definition.id.to_string(),
                label: definition.label.to_string(),
                format: definition.format,
                transport: "stdio",
                configured: false,
                path_mismatch: false,
                path: String::new(),
                snippet: String::new(),
                note: definition.note.to_string(),
                error: Some(error),
            }),
        }
    }
    Ok(statuses)
}

fn send_json(stdin: &mut impl Write, value: Value) -> Result<(), String> {
    let mut line = serde_json::to_string(&value).map_err(|error| error.to_string())?;
    line.push('\n');
    stdin
        .write_all(line.as_bytes())
        .map_err(|error| error.to_string())
}

fn receive_json(
    receiver: &mpsc::Receiver<Result<String, String>>,
    id: u64,
) -> Result<Value, String> {
    let deadline = Duration::from_secs(8);
    loop {
        let line = receiver
            .recv_timeout(deadline)
            .map_err(|error| format!("等待 MCP 服务响应超时或退出：{error}"))??;
        let value: Value =
            serde_json::from_str(&line).map_err(|error| format!("MCP 响应不是 JSON：{error}"))?;
        if value.get("id").and_then(Value::as_u64) == Some(id) {
            if let Some(error) = value.get("error") {
                return Err(format!("MCP 服务返回错误：{error}"));
            }
            return value
                .get("result")
                .cloned()
                .ok_or_else(|| "MCP 响应缺少 result".to_string());
        }
    }
}

fn drain_stderr(reader: impl std::io::Read + Send + 'static) -> Arc<Mutex<String>> {
    let output = Arc::new(Mutex::new(String::new()));
    let sink = Arc::clone(&output);
    std::thread::spawn(move || {
        for line in BufReader::new(reader).lines() {
            let Ok(line) = line else { break };
            let mut tail = match sink.lock() {
                Ok(tail) => tail,
                Err(poisoned) => poisoned.into_inner(),
            };
            tail.push_str(&line);
            tail.push('\n');
            while tail.chars().count() > 8192 {
                tail.remove(0);
            }
        }
    });
    output
}

fn stderr_tail(output: &Mutex<String>) -> String {
    let tail = match output.lock() {
        Ok(tail) => tail,
        Err(poisoned) => poisoned.into_inner(),
    };
    tail.trim().to_string()
}

fn probe_server_sync() -> Result<Value, String> {
    let binary = resolve_mcp_server_path()?;
    let mut child = Command::new(binary)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("启动 MCP sidecar 失败：{error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "无法打开 MCP sidecar stdin".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "无法打开 MCP sidecar stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "无法打开 MCP sidecar stderr".to_string())?;
    // sidecar 可能持续写日志；必须同步排空管道，否则日志写满后会卡住握手。
    let stderr_output = drain_stderr(stderr);
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            if sender
                .send(line.map_err(|error| error.to_string()))
                .is_err()
            {
                break;
            }
        }
    });

    let result: Result<Value, String> = (|| {
        let initialize = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": { "name": "Zeditor", "version": env!("CARGO_PKG_VERSION") },
            },
        });
        send_json(&mut stdin, initialize)?;
        let initialized = receive_json(&receiver, 1)?;
        send_json(
            &mut stdin,
            json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
        )?;
        send_json(
            &mut stdin,
            json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {} }),
        )?;
        let tools = receive_json(&receiver, 2)?;
        Ok(json!({
            "ok": true,
            "protocolVersion": initialized.get("protocolVersion").cloned().unwrap_or(Value::Null),
            "serverInfo": initialized.get("serverInfo").cloned().unwrap_or(Value::Null),
            "tools": tools.get("tools").and_then(Value::as_array).map(Vec::len).unwrap_or(0),
        }))
    })();

    let _ = child.kill();
    let _ = child.wait();
    result.map_err(|error| {
        let tail = stderr_tail(&stderr_output);
        if tail.is_empty() {
            error
        } else {
            format!("{error}\n{tail}")
        }
    })
}

/// 启动 sidecar 并完成 initialize + tools/list 握手，用于设置页连接自检。
#[tauri::command]
pub async fn mcp_probe_server() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(probe_server_sync)
        .await
        .map_err(|error| format!("MCP 自检任务失败：{error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(label: &str) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("zeditor-mcp-{label}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn stderr_drain_keeps_a_bounded_unicode_tail() {
        let output = drain_stderr(std::io::Cursor::new("日志".repeat(5000)));
        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        loop {
            let tail = output.lock().unwrap();
            if tail.chars().count() == 8192 || std::time::Instant::now() >= deadline {
                assert_eq!(tail.chars().count(), 8192);
                assert!(tail
                    .chars()
                    .all(|character| matches!(character, '日' | '志' | '\n')));
                break;
            }
            drop(tail);
            std::thread::sleep(Duration::from_millis(1));
        }
    }

    #[test]
    fn json_round_trip_preserves_unrelated_servers() {
        let binary = Path::new("C:\\Program Files\\Zeditor\\zeditor_mcp_server.exe");
        let original = r#"{"theme":"dark","mcpServers":{"other":{"command":"other"},"zeditor":{"command":"old"}}}"#;
        let updated = upsert_json(original, binary).unwrap();
        let root: Value = serde_json::from_str(&updated).unwrap();
        assert_eq!(root["theme"], "dark");
        assert_eq!(root["mcpServers"]["other"]["command"], "other");
        assert_eq!(
            root["mcpServers"]["zeditor"]["command"],
            binary.to_string_lossy().as_ref()
        );
        assert!(configured_command(ClientConfigFormat::Json, &updated)
            .unwrap()
            .is_some());
    }

    #[test]
    fn malformed_json_is_not_overwritten() {
        let binary = Path::new("zeditor_mcp_server");
        assert!(upsert_json("{broken", binary).is_err());
    }

    #[test]
    fn toml_repair_preserves_comments_and_other_tables() {
        let binary = Path::new("/opt/zeditor/zeditor_mcp_server");
        let original = "# keep\n[mcp_servers.other]\ncommand = \"other\"\n\n[mcp_servers.zeditor]\ncommand = \"/old\"\n";
        let updated = upsert_toml(original, binary).unwrap();
        assert!(updated.contains("# keep"));
        assert!(updated.contains("[mcp_servers.other]"));
        assert_eq!(
            configured_command(ClientConfigFormat::Toml, &updated).unwrap(),
            Some(binary.to_string_lossy().into_owned())
        );
    }

    #[test]
    fn deepseek_patch_upserts_zeditor_entry() {
        let binary = Path::new("/opt/zeditor/zeditor_mcp_server");
        let original = "- insert:\n    - id: other\n      name: other\n";
        let updated = upsert_yaml(original, binary).unwrap();
        let updated_twice = upsert_yaml(&updated, binary).unwrap();
        assert_eq!(updated.matches("id: zeditor").count(), 1);
        assert_eq!(updated_twice.matches("id: zeditor").count(), 1);
        assert!(updated.contains("other"));
        assert_eq!(
            configured_command(ClientConfigFormat::Yaml, &updated_twice).unwrap(),
            Some(binary.to_string_lossy().into_owned())
        );
    }

    #[test]
    fn malformed_toml_and_yaml_are_not_overwritten() {
        let binary = Path::new("zeditor_mcp_server");
        assert!(upsert_toml("[broken", binary).is_err());
        assert!(upsert_yaml("- insert: [", binary).is_err());
    }

    #[test]
    fn empty_config_is_uninstalled_not_an_error() {
        for format in [
            ClientConfigFormat::Json,
            ClientConfigFormat::Toml,
            ClientConfigFormat::Yaml,
        ] {
            assert_eq!(inspect_config(format, "", None), (false, false, None));
        }
    }

    #[test]
    fn status_detects_installed_and_mismatched_commands() {
        let expected = Path::new("/opt/zeditor/zeditor_mcp_server");
        let installed =
            r#"{"mcpServers":{"zeditor":{"command":"/opt/zeditor/zeditor_mcp_server"}}}"#;
        let mismatched = r#"{"mcpServers":{"zeditor":{"command":"/old/zeditor_mcp_server"}}}"#;
        assert_eq!(
            inspect_config(ClientConfigFormat::Json, installed, Some(expected)),
            (true, false, None)
        );
        assert_eq!(
            inspect_config(ClientConfigFormat::Json, mismatched, Some(expected)),
            (true, true, None)
        );
    }

    #[test]
    fn client_registry_ids_are_unique_and_include_generic() {
        let ids: std::collections::HashSet<_> = CLIENTS.iter().map(|client| client.id).collect();
        assert_eq!(ids.len(), CLIENTS.len());
        assert!(ids.contains("generic"));
        assert!(ids.contains("qoder_cn"));
    }

    #[test]
    fn atomic_write_creates_backup_and_replaces_file() {
        let directory = temp_dir("atomic");
        let path = directory.join("settings.json");
        fs::write(&path, "old").unwrap();
        let backup = write_config_atomic(&path, "new").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        assert_eq!(fs::read_to_string(backup).unwrap(), "old");
        let _ = fs::remove_dir_all(directory);
    }
}
