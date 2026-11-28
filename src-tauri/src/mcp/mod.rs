//! MCP 桥接：编辑器内置 WebSocket 服务，把 MCP server 二进制
//!（`zeditor_mcp_server`，stdio）的工具调用转发给前端执行。
//!
//! 参考 VMark 的 MCP 架构：AI 助手 ←stdio→ MCP server ←WebSocket→ 编辑器。
//! 安全边界：仅监听 127.0.0.1，连接需持有 app_config_dir/mcp_bridge.json
//! 中的随机令牌；所有工具调用最终由前端在用户可见的编辑器状态下执行。

pub mod clients;
mod protocol;

pub use protocol::{BridgeFrame, BridgeInfo, TOOL_COUNT};

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::net::TcpListener;
use tokio::sync::{broadcast, mpsc, oneshot, Mutex};
use tokio_tungstenite::tungstenite::Message;

const CALL_TIMEOUT: Duration = Duration::from_secs(120);
const BRIDGE_INFO_FILE: &str = "mcp_bridge.json";

type PendingMap = Arc<Mutex<HashMap<String, oneshot::Sender<CallOutcome>>>>;

#[derive(Debug)]
enum CallOutcome {
    Ok(Value),
    Err(Value),
}

pub struct McpBridge {
    app: AppHandle,
    token: String,
    port: AtomicIsize,
    running: AtomicBool,
    connected: AtomicIsize,
    pending: PendingMap,
    shutdown: Mutex<Option<broadcast::Sender<()>>>,
}

impl McpBridge {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            token: uuid::Uuid::new_v4().to_string(),
            port: AtomicIsize::new(-1),
            running: AtomicBool::new(false),
            connected: AtomicIsize::new(0),
            pending: Arc::new(Mutex::new(HashMap::new())),
            shutdown: Mutex::new(None),
        }
    }

    fn info_path(&self) -> Result<PathBuf, String> {
        Ok(self
            .app
            .path()
            .app_config_dir()
            .map_err(|e| e.to_string())?
            .join(BRIDGE_INFO_FILE))
    }

    pub fn status(&self) -> Value {
        json!({
            "running": self.running.load(Ordering::SeqCst),
            "port": self.port.load(Ordering::SeqCst),
            "connected": self.connected.load(Ordering::SeqCst).max(0),
            "version": env!("CARGO_PKG_VERSION"),
            "tools": TOOL_COUNT,
        })
    }

    pub async fn start(&self) -> Result<(), String> {
        if self.running.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("MCP 桥接绑定本地端口失败：{e}"))?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        self.port.store(port as isize, Ordering::SeqCst);

        let info = BridgeInfo {
            port,
            token: self.token.clone(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        };
        let info_path = self.info_path()?;
        if let Some(parent) = info_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(
            &info_path,
            serde_json::to_string_pretty(&info).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;

        let (shutdown_tx, _) = broadcast::channel::<()>(1);
        *self.shutdown.lock().await = Some(shutdown_tx.clone());
        let app = self.app.clone();
        let pending = self.pending.clone();
        let token = self.token.clone();

        tauri::async_runtime::spawn(async move {
            let connected_count = Arc::new(AtomicIsize::new(0));
            let mut shutdown_rx = shutdown_tx.subscribe();
            loop {
                tokio::select! {
                    _ = shutdown_rx.recv() => break,
                    accepted = listener.accept() => {
                        let Ok((stream, _)) = accepted else { break };
                        let app = app.clone();
                        let pending = pending.clone();
                        let token = token.clone();
                        let count = connected_count.clone();
                        tauri::async_runtime::spawn(handle_connection(
                            stream, app, pending, token, count, shutdown_tx.clone(),
                        ));
                    }
                }
            }
        });

        let _ = self.app.emit(
            "mcp-event",
            json!({ "event": "started", "data": self.status() }),
        );
        Ok(())
    }

    pub async fn stop(&self) {
        if !self.running.swap(false, Ordering::SeqCst) {
            return;
        }
        if let Some(tx) = self.shutdown.lock().await.take() {
            let _ = tx.send(());
        }
        if let Ok(path) = self.info_path() {
            let _ = std::fs::remove_file(path);
        }
        self.port.store(-1, Ordering::SeqCst);
        let _ = self.app.emit(
            "mcp-event",
            json!({ "event": "stopped", "data": self.status() }),
        );
    }
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    app: AppHandle,
    pending: PendingMap,
    token: String,
    connected_count: Arc<AtomicIsize>,
    shutdown: broadcast::Sender<()>,
) {
    let ws = match tokio_tungstenite::accept_async(stream).await {
        Ok(ws) => ws,
        Err(_) => return,
    };
    let (mut writer, mut reader) = ws.split();
    let (write_tx, mut write_rx) = mpsc::unbounded_channel::<Message>();
    let mut shutdown_rx = shutdown.subscribe();

    // 认证：首帧必须是持有正确令牌的 Hello（单帧应答，失败即断开）。
    tokio::select! {
        _ = shutdown_rx.recv() => return,
        frame = reader.next() => {
            let Some(Ok(Message::Text(text))) = frame else { return };
            match serde_json::from_str::<BridgeFrame>(&text) {
                Ok(BridgeFrame::Hello { token: got }) => {
                    if got != token {
                        let err = serde_json::to_string(&BridgeFrame::Error {
                            message: "认证失败：桥接令牌不匹配".to_string(),
                        })
                        .unwrap_or_default();
                        let _ = write_tx.send(Message::Text(err));
                        return;
                    }
                    let ok = serde_json::to_string(&BridgeFrame::HelloOk {
                        version: env!("CARGO_PKG_VERSION").to_string(),
                    })
                    .unwrap_or_default();
                    if write_tx.send(Message::Text(ok)).is_err() {
                        return;
                    }
                }
                _ => {
                    let err = serde_json::to_string(&BridgeFrame::Error {
                        message: "首帧必须是 Hello 认证".to_string(),
                    })
                    .unwrap_or_default();
                    let _ = write_tx.send(Message::Text(err));
                    return;
                }
            }
        }
    }

    connected_count.fetch_add(1, Ordering::SeqCst);
    let _ = app.emit("mcp-event", json!({ "event": "connected" }));

    // 写出任务：mpsc → websocket。
    let write_task = tauri::async_runtime::spawn(async move {
        while let Some(message) = write_rx.recv().await {
            if writer.send(message).await.is_err() {
                break;
            }
        }
        let _ = writer.close().await;
    });

    // 读入循环：Call 帧 → 前端；bridge.ping 本地应答。
    loop {
        tokio::select! {
                _ = shutdown_rx.recv() => break,
                frame = reader.next() => {
                    let Some(Ok(Message::Text(text))) = frame else { break };
                    let Ok(frame) = serde_json::from_str::<BridgeFrame>(&text) else { continue };
                    if let BridgeFrame::Call { id, method, params } = frame {
                        if method == protocol::BRIDGE_PING_METHOD {
                                let pong = serde_json::to_string(&BridgeFrame::Result {
                                    id,
                                    result: Some(json!("pong")),
                                    error: None,
                                })
                                .unwrap_or_default();
                                if write_tx.send(Message::Text(pong)).is_err() {
                                    break;
                                }
                                continue;
                            }
                            let app = app.clone();
                            let pending = pending.clone();
                            let write_tx = write_tx.clone();
                            tauri::async_runtime::spawn(async move {
                                // 等待前端应答后再把结果帧送回本条连接。
                                let (tx, rx) = oneshot::channel::<CallOutcome>();
                                pending.lock().await.insert(id.clone(), tx);
                                let payload = json!({ "id": id, "method": method, "params": params });
                                if app.emit("mcp-call", payload).is_err() {
                                    pending.lock().await.remove(&id);
                                    return;
                                }
                                let outcome = match tokio::time::timeout(CALL_TIMEOUT, rx).await {
                                    Ok(outcome) => outcome.unwrap_or(CallOutcome::Err(json!({
                                        "error": "INTERNAL", "message": "调用结果通道已断开",
                                    }))),
                                    Err(_) => {
                                        pending.lock().await.remove(&id);
                                        CallOutcome::Err(json!({
                                            "error": "TIMEOUT", "message": "编辑器未在 120 秒内应答",
                                        }))
                                    }
                                };
                                let frame = match outcome {
                                    CallOutcome::Ok(result) => BridgeFrame::Result {
                                        id, result: Some(result), error: None,
                                    },
                                    CallOutcome::Err(error) => BridgeFrame::Result {
                                        id, result: None, error: Some(error),
                                    },
                                };
                                let _ = write_tx.send(Message::Text(
                                    serde_json::to_string(&frame).unwrap_or_default(),
                                ));
                            });
                }
            }
        }
    }

    connected_count.fetch_sub(1, Ordering::SeqCst);
    let _ = app.emit("mcp-event", json!({ "event": "disconnected" }));
    drop(write_tx);
    let _ = write_task.await;
}

// ── Tauri 命令 ──────────────────────────────────────────────

#[tauri::command]
pub fn mcp_bridge_status(state: State<'_, McpBridge>) -> Value {
    state.status()
}

#[tauri::command]
pub async fn mcp_bridge_set_enabled(
    state: State<'_, McpBridge>,
    enabled: bool,
) -> Result<Value, String> {
    if enabled {
        state.start().await?;
    } else {
        state.stop().await;
    }
    Ok(state.status())
}

#[tauri::command]
pub async fn mcp_bridge_respond(
    state: State<'_, McpBridge>,
    id: String,
    result: Option<Value>,
    error: Option<Value>,
) -> Result<(), String> {
    let sender = state.pending.lock().await.remove(&id);
    if let Some(sender) = sender {
        let outcome = match (result, error) {
            (_, Some(err)) => CallOutcome::Err(err),
            (Some(value), None) => CallOutcome::Ok(value),
            (None, None) => CallOutcome::Err(json!({
                "error": "INTERNAL", "message": "空响应",
            })),
        };
        let _ = sender.send(outcome);
    }
    Ok(())
}

/// 解析 MCP server 二进制路径：优先使用打包的 sidecar（安装目录），
/// 开发环境回退到 target/<profile>/ 下的构建产物。
pub fn resolve_mcp_server_path() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().ok_or("无法定位可执行文件目录")?;
    let binary = if cfg!(windows) {
        "zeditor_mcp_server.exe"
    } else {
        "zeditor_mcp_server"
    };
    let sidecar = dir.join(binary);
    if sidecar.exists() {
        return Ok(sidecar);
    }
    // 开发环境：cargo 构建产物（tauri dev 时主 exe 在 target/<triple>/debug）。
    for candidate in [
        dir.join(binary),
        dir.join("..").join(binary),
        dir.join("..").join("..").join(binary),
    ] {
        let normalized = candidate.canonicalize().unwrap_or(candidate);
        if normalized.exists() {
            return Ok(normalized);
        }
    }
    Err(format!(
        "未找到 {binary}：请先运行 cargo build --release --bin zeditor_mcp_server"
    ))
}

/// 桥接信息文件位置（MCP server 二进制用同一逻辑发现端口与令牌）。
#[allow(dead_code)]
pub fn bridge_info_path(config_dir: &Path) -> PathBuf {
    config_dir.join(BRIDGE_INFO_FILE)
}
