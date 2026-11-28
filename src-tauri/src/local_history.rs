use super::*;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub const MAX_HISTORY_BYTES: usize = 5 * 1024 * 1024;
const MAX_HISTORY_VERSIONS: usize = 100;
const MAX_HISTORY_DAYS: i64 = 90;
static HISTORY_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryEntry {
    pub version_id: String,
    pub document_id: String,
    pub path: String,
    pub created_at: DateTime<Utc>,
    pub sha256: String,
    pub size: usize,
    pub encoding: String,
    pub label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryContent {
    pub entry: LocalHistoryEntry,
    pub content: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct HistoryIndex {
    versions: Vec<LocalHistoryEntry>,
}

/// 本地耐久版本库。与 recovery、WebDAV/S3 版本使用独立存储和保留策略。
pub struct LocalHistoryStore {
    root: PathBuf,
}

impl LocalHistoryStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn document_dir(&self, document_id: &str) -> Result<PathBuf, String> {
        if document_id.is_empty()
            || !document_id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
        {
            return Err("无效的文档身份".into());
        }
        Ok(self.root.join(document_id))
    }

    fn index_path(&self, document_id: &str) -> Result<PathBuf, String> {
        Ok(self.document_dir(document_id)?.join("index.json"))
    }

    fn read_index(&self, document_id: &str) -> Result<HistoryIndex, String> {
        let path = self.index_path(document_id)?;
        if !path.exists() {
            return Ok(HistoryIndex::default());
        }
        serde_json::from_str(&fs::read_to_string(path).map_err(|error| error.to_string())?)
            .map_err(|error| format!("本地历史索引损坏：{error}"))
    }

    fn write_index(&self, document_id: &str, index: &HistoryIndex) -> Result<(), String> {
        let dir = self.document_dir(document_id)?;
        fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
        let temporary = dir.join(format!(".index-{}.tmp", uuid::Uuid::new_v4()));
        fs::write(
            &temporary,
            serde_json::to_vec_pretty(index).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
        fs::rename(&temporary, dir.join("index.json")).map_err(|error| error.to_string())
    }

    fn prune(&self, document_id: &str, index: &mut HistoryIndex) -> Result<(), String> {
        let cutoff = Utc::now() - Duration::days(MAX_HISTORY_DAYS);
        index.versions.retain(|entry| {
            if entry.created_at < cutoff || entry.size > MAX_HISTORY_BYTES {
                if let Ok(path) = self.version_path(document_id, &entry.version_id) {
                    let _ = fs::remove_file(path);
                }
                false
            } else {
                true
            }
        });
        while index.versions.len() > MAX_HISTORY_VERSIONS {
            let removed = index.versions.remove(0);
            if let Ok(path) = self.version_path(document_id, &removed.version_id) {
                let _ = fs::remove_file(path);
            }
        }
        Ok(())
    }

    fn version_path(&self, document_id: &str, version_id: &str) -> Result<PathBuf, String> {
        if version_id.is_empty()
            || !version_id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
        {
            return Err("无效的历史版本 ID".into());
        }
        Ok(self
            .document_dir(document_id)?
            .join(format!("{version_id}.md")))
    }

    pub fn record(
        &self,
        document_id: &str,
        path: &str,
        content: &str,
        encoding: &str,
        label: &str,
    ) -> Result<LocalHistoryEntry, String> {
        let _guard = HISTORY_LOCK.lock().map_err(|_| "本地历史锁已损坏")?;
        let bytes = crate::text_encoding::encode_text(content, encoding)?;
        if bytes.len() > MAX_HISTORY_BYTES {
            return Err(format!(
                "本地历史单版本不能超过 {} MiB",
                MAX_HISTORY_BYTES / 1024 / 1024
            ));
        }
        let sha256 = hex::encode(Sha256::digest(&bytes));
        let dir = self.document_dir(document_id)?;
        fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
        let mut index = self.read_index(document_id)?;
        index.versions.sort_by_key(|entry| entry.created_at);
        if let Some(existing) = index
            .versions
            .iter()
            .find(|entry| entry.sha256 == sha256 && entry.encoding == encoding)
            .cloned()
        {
            return Ok(existing);
        }
        let version_id = uuid::Uuid::new_v4().simple().to_string();
        let entry = LocalHistoryEntry {
            version_id: version_id.clone(),
            document_id: document_id.to_string(),
            path: path.to_string(),
            created_at: Utc::now(),
            sha256,
            size: bytes.len(),
            encoding: encoding.to_string(),
            label: label.chars().take(120).collect(),
        };
        let target = self.version_path(document_id, &version_id)?;
        let temporary = dir.join(format!(".{version_id}.tmp"));
        fs::write(&temporary, bytes).map_err(|error| error.to_string())?;
        fs::rename(&temporary, &target).map_err(|error| error.to_string())?;
        index.versions.push(entry.clone());
        self.prune(document_id, &mut index)?;
        self.write_index(document_id, &index)?;
        Ok(entry)
    }

    pub fn list(&self, document_id: &str) -> Result<Vec<LocalHistoryEntry>, String> {
        let _guard = HISTORY_LOCK.lock().map_err(|_| "本地历史锁已损坏")?;
        let mut index = self.read_index(document_id)?;
        self.prune(document_id, &mut index)?;
        self.write_index(document_id, &index)?;
        index
            .versions
            .sort_by_key(|entry| std::cmp::Reverse(entry.created_at));
        Ok(index.versions)
    }

    pub fn read(&self, document_id: &str, version_id: &str) -> Result<LocalHistoryContent, String> {
        let _guard = HISTORY_LOCK.lock().map_err(|_| "本地历史锁已损坏")?;
        let index = self.read_index(document_id)?;
        let entry = index
            .versions
            .iter()
            .find(|entry| entry.version_id == version_id)
            .cloned()
            .ok_or_else(|| "历史版本不存在".to_string())?;
        let bytes = fs::read(self.version_path(document_id, version_id)?)
            .map_err(|error| error.to_string())?;
        if bytes.len() > MAX_HISTORY_BYTES || hex::encode(Sha256::digest(&bytes)) != entry.sha256 {
            return Err("历史版本校验失败".into());
        }
        let content = crate::text_encoding::decode_text(&bytes, Some(&entry.encoding))
            .map_err(|error| error.to_string())?
            .content;
        Ok(LocalHistoryContent { entry, content })
    }

    pub fn delete(&self, document_id: &str, version_id: &str) -> Result<(), String> {
        let _guard = HISTORY_LOCK.lock().map_err(|_| "本地历史锁已损坏")?;
        let mut index = self.read_index(document_id)?;
        index
            .versions
            .retain(|entry| entry.version_id != version_id);
        fs::remove_file(self.version_path(document_id, version_id)?).or_else(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                Ok(())
            } else {
                Err(error.to_string())
            }
        })?;
        self.write_index(document_id, &index)
    }

    pub fn migrate(&self, old_id: &str, new_id: &str, new_path: &str) -> Result<(), String> {
        let _guard = HISTORY_LOCK.lock().map_err(|_| "本地历史锁已损坏")?;
        let old_dir = self.document_dir(old_id)?;
        if !old_dir.exists() {
            return Ok(());
        }
        let new_dir = self.document_dir(new_id)?;
        if new_dir.exists() {
            return Err("目标文档已有本地历史，未执行合并".into());
        }
        let mut index = self.read_index(old_id)?;
        for entry in &mut index.versions {
            entry.document_id = new_id.to_string();
            entry.path = new_path.to_string();
        }
        self.write_index(new_id, &index)?;
        for entry in &index.versions {
            let target = self.version_path(new_id, &entry.version_id)?;
            fs::rename(self.version_path(old_id, &entry.version_id)?, target)
                .map_err(|error| error.to_string())?;
        }
        fs::remove_dir_all(old_dir).map_err(|error| error.to_string())
    }
}

fn history_store(app: &tauri::AppHandle) -> Result<LocalHistoryStore, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("local-history");
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(LocalHistoryStore::new(root))
}

#[tauri::command]
pub async fn local_history_record(
    app: tauri::AppHandle,
    document_id: String,
    path: String,
    content: String,
    encoding: Option<String>,
    label: Option<String>,
) -> Result<LocalHistoryEntry, String> {
    history_store(&app)?.record(
        &document_id,
        &path,
        &content,
        encoding.as_deref().unwrap_or("utf-8"),
        label.as_deref().unwrap_or("自动保存"),
    )
}

#[tauri::command]
pub async fn local_history_list(
    app: tauri::AppHandle,
    document_id: String,
) -> Result<Vec<LocalHistoryEntry>, String> {
    history_store(&app)?.list(&document_id)
}

#[tauri::command]
pub async fn local_history_read(
    app: tauri::AppHandle,
    document_id: String,
    version_id: String,
) -> Result<LocalHistoryContent, String> {
    history_store(&app)?.read(&document_id, &version_id)
}

#[tauri::command]
pub async fn local_history_delete(
    app: tauri::AppHandle,
    document_id: String,
    version_id: String,
) -> Result<(), String> {
    history_store(&app)?.delete(&document_id, &version_id)
}

#[tauri::command]
pub async fn local_history_migrate(
    app: tauri::AppHandle,
    old_document_id: String,
    new_document_id: String,
    new_path: String,
) -> Result<(), String> {
    history_store(&app)?.migrate(&old_document_id, &new_document_id, &new_path)
}

#[cfg(test)]
fn temp_root(name: &str) -> PathBuf {
    let path =
        std::env::temp_dir().join(format!("zeditor-history-{name}-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn history_deduplicates_identical_content_and_survives_reopen() {
    let root = temp_root("dedupe");
    let store = LocalHistoryStore::new(root.clone());
    let first = store
        .record("doc-a", "C:/notes/a.md", "第一版", "utf-8", "保存")
        .unwrap();
    let duplicate = store
        .record("doc-a", "C:/notes/a.md", "第一版", "utf-8", "再次保存")
        .unwrap();
    assert_eq!(first.version_id, duplicate.version_id);
    store
        .record("doc-a", "C:/notes/a.md", "第二版", "utf-8", "保存")
        .unwrap();

    let reopened = LocalHistoryStore::new(root.clone());
    let versions = reopened.list("doc-a").unwrap();
    assert_eq!(versions.len(), 2);
    assert_eq!(
        reopened
            .read("doc-a", &versions[0].version_id)
            .unwrap()
            .content,
        "第二版"
    );
    let _ = fs::remove_dir_all(root);
}

#[test]
fn history_prunes_old_entries_and_rejects_oversized_content() {
    let root = temp_root("limits");
    let store = LocalHistoryStore::new(root.clone());
    let index_path = root.join("doc-a").join("index.json");
    fs::create_dir_all(index_path.parent().unwrap()).unwrap();
    fs::write(&index_path, r#"{"versions":[{"versionId":"old","documentId":"doc-a","path":"C:/notes/a.md","createdAt":"2000-01-01T00:00:00Z","sha256":"old","size":3,"encoding":"utf-8","label":"旧"}]}"#).unwrap();
    store
        .record("doc-a", "C:/notes/a.md", "新", "utf-8", "保存")
        .unwrap();
    assert_eq!(store.list("doc-a").unwrap().len(), 1);
    assert!(store
        .record(
            "doc-a",
            "C:/notes/a.md",
            &"x".repeat(MAX_HISTORY_BYTES + 1),
            "utf-8",
            "保存"
        )
        .is_err());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn history_preserves_legacy_encoding() {
    let root = temp_root("encoding");
    let store = LocalHistoryStore::new(root.clone());
    let entry = store
        .record("doc-gbk", "C:/notes/gbk.md", "中文历史", "gbk", "保存")
        .unwrap();
    assert_eq!(entry.encoding, "gbk");
    assert_eq!(
        store.read("doc-gbk", &entry.version_id).unwrap().content,
        "中文历史"
    );
    let _ = fs::remove_dir_all(root);
}

#[test]
fn history_deduplication_includes_encoding() {
    let root = temp_root("encoding-dedupe");
    let store = LocalHistoryStore::new(root.clone());
    let utf8 = store
        .record("doc", "C:/note.md", "é", "utf-8", "保存")
        .unwrap();
    let gbk = store
        .record("doc", "C:/note.md", "茅", "gbk", "保存")
        .unwrap();
    assert_ne!(utf8.version_id, gbk.version_id);
    assert_eq!(store.read("doc", &utf8.version_id).unwrap().content, "é");
    assert_eq!(store.read("doc", &gbk.version_id).unwrap().content, "茅");
    let _ = fs::remove_dir_all(root);
}

#[test]
fn history_path_migration_preserves_versions() {
    let root = temp_root("migration");
    let store = LocalHistoryStore::new(root.clone());
    store
        .record("doc-old", "C:/notes/old.md", "内容", "utf-8", "保存")
        .unwrap();
    store
        .migrate("doc-old", "doc-new", "C:/notes/new.md")
        .unwrap();
    assert!(store.list("doc-old").unwrap().is_empty());
    let versions = store.list("doc-new").unwrap();
    assert_eq!(versions.len(), 1);
    assert_eq!(versions[0].path, "C:/notes/new.md");
    let _ = fs::remove_dir_all(root);
}
