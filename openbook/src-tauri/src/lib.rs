use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

/// Empêche l'ouverture d'une fenêtre console quand on lance un exécutable.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn spawn_hidden(cmd: &mut Command) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.spawn().map(|_| ())
}

/// Seules les URL https:// sans espace ni caractère de contrôle passent.
fn is_safe_https(url: &str) -> bool {
    url.starts_with("https://")
        && url.len() > "https://".len()
        && url.len() < 2048
        && !url.chars().any(|c| c.is_whitespace() || c.is_control() || c == '"')
}

/// Chrome aux emplacements standard, sinon Edge.
fn find_browser() -> Option<PathBuf> {
    let env = |k: &str| std::env::var_os(k).map(PathBuf::from);
    let mut candidates: Vec<PathBuf> = Vec::new();
    for base in [env("ProgramFiles"), env("ProgramFiles(x86)"), env("LOCALAPPDATA")]
        .into_iter()
        .flatten()
    {
        candidates.push(base.join(r"Google\Chrome\Application\chrome.exe"));
    }
    for base in [env("ProgramFiles(x86)"), env("ProgramFiles"), env("LOCALAPPDATA")]
        .into_iter()
        .flatten()
    {
        candidates.push(base.join(r"Microsoft\Edge\Application\msedge.exe"));
    }
    candidates.into_iter().find(|p| p.is_file())
}

/// Ouvre un service web en « mode application » (fenêtre sans onglets),
/// avec le profil habituel du navigateur pour rester connecté à Google.
#[tauri::command]
fn open_app(app: AppHandle, url: String) -> Result<&'static str, String> {
    if !is_safe_https(&url) {
        return Err("Seules les adresses https:// sont acceptées.".into());
    }
    if cfg!(windows) {
        if let Some(browser) = find_browser() {
            // Pas de shell : l'URL est un seul argument, jamais interprété.
            let arg = format!("--app={url}");
            if spawn_hidden(Command::new(&browser).arg(arg)).is_ok() {
                return Ok("app");
            }
        }
    }
    app.opener()
        .open_url(&url, None::<&str>)
        .map(|_| "browser")
        .map_err(|e| e.to_string())
}

/// Ouvre l'explorateur de fichiers Windows.
#[tauri::command]
fn open_files() -> Result<(), String> {
    if !cfg!(windows) {
        return Err("L'explorateur de fichiers n'existe que sous Windows.".into());
    }
    spawn_hidden(&mut Command::new("explorer.exe")).map_err(|e| e.to_string())
}

/// Verrouiller, redémarrer ou éteindre. L'interface demande toujours
/// une confirmation avant d'appeler cette commande.
#[tauri::command]
fn power(action: String) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("Disponible uniquement sous Windows.".into());
    }
    let mut cmd = match action.as_str() {
        "lock" => {
            let mut c = Command::new("rundll32.exe");
            c.arg("user32.dll,LockWorkStation");
            c
        }
        "restart" => {
            let mut c = Command::new("shutdown.exe");
            c.args(["/r", "/t", "0"]);
            c
        }
        "shutdown" => {
            let mut c = Command::new("shutdown.exe");
            c.args(["/s", "/t", "0"]);
            c
        }
        _ => return Err("Action inconnue.".into()),
    };
    spawn_hidden(&mut cmd).map_err(|e| e.to_string())
}

/// OpenBook sert d'écran d'accueil : s'il est réduit (Win+D, Win+M,
/// « Afficher le bureau »), il revient aussitôt, comme le bureau Windows.
fn keep_as_home(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(400));
        let Some(win) = app.get_webview_window("main") else {
            break;
        };
        if win.is_minimized().unwrap_or(false) {
            let _ = win.unminimize();
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_app, open_files, power])
        .setup(|app| {
            keep_as_home(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("impossible de démarrer OpenBook");
}
