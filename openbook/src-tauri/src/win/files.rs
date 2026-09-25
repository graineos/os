//! Fichiers pour le lanceur : index des dossiers personnels (Bureau, Documents,
//! Téléchargements, Images, Musique, Vidéos) et fichiers récents de Windows.
//! Rien ne quitte l'ordinateur ; l'index vit en mémoire.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct FileHit {
    pub name: String,
    pub path: String,
    pub folder: String,
    pub dir: bool,
    pub modified: u64,
}

static INDEX: Mutex<Vec<FileHit>> = Mutex::new(Vec::new());
const MAX_ENTRIES: usize = 60_000;

pub fn roots() -> Vec<PathBuf> {
    let Some(home) = std::env::var_os("USERPROFILE").map(PathBuf::from) else { return Vec::new() };
    ["Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"]
        .iter()
        .map(|d| home.join(d))
        .filter(|p| p.is_dir())
        .collect()
}

fn recent_dir() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|a| PathBuf::from(a).join(r"Microsoft\Windows\Recent"))
}

fn secs(t: std::io::Result<SystemTime>) -> u64 {
    t.ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0)
}

fn walk(dir: &Path, depth: u32, out: &mut Vec<FileHit>) {
    if out.len() >= MAX_ENTRIES {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name.starts_with('~') || name.eq_ignore_ascii_case("desktop.ini") {
            continue;
        }
        let Ok(meta) = e.metadata() else { continue };
        let path = e.path();
        out.push(FileHit {
            name,
            path: path.to_string_lossy().to_string(),
            folder: dir.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default(),
            dir: meta.is_dir(),
            modified: secs(meta.modified()),
        });
        if meta.is_dir() && depth < 5 && !meta.file_type().is_symlink() {
            walk(&path, depth + 1, out);
        }
    }
}

/// (Ré)indexe en arrière-plan au démarrage puis toutes les 10 minutes.
pub fn start_indexer() {
    std::thread::spawn(|| loop {
        let mut all = Vec::new();
        for root in roots() {
            walk(&root, 0, &mut all);
        }
        if let Ok(mut idx) = INDEX.lock() {
            *idx = all;
        }
        std::thread::sleep(Duration::from_secs(600));
    });
}

fn fold(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| match c {
            'à' | 'â' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'î' | 'ï' => 'i',
            'ô' | 'ö' => 'o',
            'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            other => other,
        })
        .collect()
}

pub fn search(query: &str, limit: usize) -> Vec<FileHit> {
    let q = fold(query.trim());
    if q.len() < 2 {
        return Vec::new();
    }
    let Ok(idx) = INDEX.lock() else { return Vec::new() };
    let mut hits: Vec<(u8, &FileHit)> = idx
        .iter()
        .filter_map(|f| {
            let n = fold(&f.name);
            if n.starts_with(&q) {
                Some((0, f))
            } else if n.contains(&q) {
                Some((1, f))
            } else {
                None
            }
        })
        .collect();
    hits.sort_by(|a, b| a.0.cmp(&b.0).then(b.1.modified.cmp(&a.1.modified)));
    hits.into_iter().take(limit).map(|(_, f)| f.clone()).collect()
}

/// Fichiers récents de Windows (raccourcis du dossier Recent), du plus récent au plus ancien.
pub fn recent(limit: usize) -> Vec<FileHit> {
    let Some(dir) = recent_dir() else { return Vec::new() };
    let Ok(entries) = std::fs::read_dir(&dir) else { return Vec::new() };
    let mut out: Vec<FileHit> = entries
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x.eq_ignore_ascii_case("lnk")))
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let name = e.path().file_stem()?.to_string_lossy().to_string();
            // Les dossiers récents n'ont pas d'extension : on garde surtout les fichiers.
            if !name.contains('.') {
                return None;
            }
            Some(FileHit {
                name,
                path: e.path().to_string_lossy().to_string(),
                folder: "Récents".into(),
                dir: false,
                modified: secs(meta.modified()),
            })
        })
        .collect();
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    out.truncate(limit);
    out
}

/// Seuls les fichiers des dossiers personnels ou des récents peuvent être ouverts.
pub fn is_openable(path: &str) -> bool {
    let Ok(canon) = Path::new(path).canonicalize() else { return false };
    roots()
        .into_iter()
        .chain(recent_dir())
        .filter_map(|r| r.canonicalize().ok())
        .any(|r| canon.starts_with(r))
}
