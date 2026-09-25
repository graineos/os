use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};
use tauri_plugin_opener::OpenerExt;

#[cfg(windows)]
mod win;

/// Empêche l'ouverture d'une fenêtre console quand on lance un exécutable.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const NOT_WINDOWS: &str = "Disponible uniquement sous Windows.";

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

/* ---------------------------------------------------------------------
   Applis
   --------------------------------------------------------------------- */

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
        return Err(NOT_WINDOWS.into());
    }
    spawn_hidden(&mut Command::new("explorer.exe")).map_err(|e| e.to_string())
}

/// Pages des Paramètres Windows (liste fermée).
#[tauri::command]
fn open_settings(app: AppHandle, page: String) -> Result<(), String> {
    let uri = match page.as_str() {
        "home" => "ms-settings:",
        "wifi" => "ms-settings:network-wifi",
        "network" => "ms-settings:network-status",
        "bluetooth" => "ms-settings:bluetooth",
        "nightlight" => "ms-settings:nightlight",
        "display" => "ms-settings:display",
        "sound" => "ms-settings:sound",
        "notifications" => "ms-settings:notifications",
        "power" => "ms-settings:powersleep",
        "battery" => "ms-settings:batterysaver",
        "storage" => "ms-settings:storagesense",
        "printers" => "ms-settings:printers",
        "mouse" => "ms-settings:mousetouchpad",
        "keyboard" => "ms-settings:typing",
        "personalization" => "ms-settings:personalization",
        "background" => "ms-settings:personalization-background",
        "colors" => "ms-settings:colors",
        "lockscreen" => "ms-settings:lockscreen",
        "apps" => "ms-settings:appsfeatures",
        "defaultapps" => "ms-settings:defaultapps",
        "startup" => "ms-settings:startupapps",
        "accounts" => "ms-settings:yourinfo",
        "signin" => "ms-settings:signinoptions",
        "datetime" => "ms-settings:dateandtime",
        "language" => "ms-settings:regionlanguage",
        "privacy" => "ms-settings:privacy",
        "update" => "ms-settings:windowsupdate",
        "about" => "ms-settings:about",
        "vpn" => "ms-settings:network-vpn",
        "store" => "ms-windows-store:",
        _ => return Err("Page inconnue.".into()),
    };
    app.opener().open_url(uri, None::<&str>).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct WinAppDto {
    name: String,
    path: String,
}

/// Applis installées : raccourcis du menu Démarrer.
#[tauri::command]
async fn list_windows_apps() -> Vec<WinAppDto> {
    #[cfg(windows)]
    {
        win::apps::scan().into_iter().map(|a| WinAppDto { name: a.name, path: a.path }).collect()
    }
    #[cfg(not(windows))]
    {
        Vec::new()
    }
}

/// Lance une appli installée ; seuls les raccourcis du menu Démarrer sont acceptés.
#[tauri::command]
fn launch_windows_app(app: AppHandle, path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        if !win::apps::is_start_menu_shortcut(&path) {
            return Err("Raccourci inconnu.".into());
        }
        app.opener().open_path(&path, None::<&str>).map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, path);
        Err(NOT_WINDOWS.into())
    }
}

/// Icônes (URL data: PNG) de raccourcis ou d'exécutables.
#[tauri::command]
async fn app_icons(paths: Vec<String>) -> std::collections::HashMap<String, String> {
    #[cfg(windows)]
    {
        win::apps::icons(paths)
    }
    #[cfg(not(windows))]
    {
        let _ = paths;
        Default::default()
    }
}

/* ---------------------------------------------------------------------
   Fenêtres ouvertes
   --------------------------------------------------------------------- */

#[tauri::command]
fn list_windows() -> serde_json::Value {
    #[cfg(windows)]
    {
        serde_json::to_value(win::windows::list()).unwrap_or_default()
    }
    #[cfg(not(windows))]
    {
        serde_json::Value::Array(Vec::new())
    }
}

#[tauri::command]
fn focus_window(id: i64) -> Result<(), String> {
    #[cfg(windows)]
    {
        win::windows::focus(id)
    }
    #[cfg(not(windows))]
    {
        let _ = id;
        Err(NOT_WINDOWS.into())
    }
}

#[tauri::command]
fn close_window(id: i64) -> Result<(), String> {
    #[cfg(windows)]
    {
        win::windows::close(id)
    }
    #[cfg(not(windows))]
    {
        let _ = id;
        Err(NOT_WINDOWS.into())
    }
}

/* ---------------------------------------------------------------------
   Système : alimentation, presse-papiers, volume, luminosité
   --------------------------------------------------------------------- */

/// Verrouiller, redémarrer ou éteindre. L'interface demande toujours
/// une confirmation avant d'appeler cette commande.
#[tauri::command]
fn power(action: String) -> Result<(), String> {
    if !cfg!(windows) {
        return Err(NOT_WINDOWS.into());
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

#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        win::system::copy_text(&text)
    }
    #[cfg(not(windows))]
    {
        let _ = text;
        Err(NOT_WINDOWS.into())
    }
}

#[derive(serde::Serialize, Default)]
struct VolumeDto {
    level: u8,
    muted: bool,
}

#[tauri::command]
async fn volume_get() -> Result<VolumeDto, String> {
    #[cfg(windows)]
    {
        win::audio::get().map(|v| VolumeDto { level: v.level, muted: v.muted })
    }
    #[cfg(not(windows))]
    {
        Err(NOT_WINDOWS.into())
    }
}

#[tauri::command]
async fn volume_set(level: Option<u8>, muted: Option<bool>) -> Result<(), String> {
    #[cfg(windows)]
    {
        if let Some(l) = level {
            win::audio::set_level(l)?;
        }
        if let Some(m) = muted {
            win::audio::set_muted(m)?;
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (level, muted);
        Err(NOT_WINDOWS.into())
    }
}

/// Exécute une fonction Windows, ou renvoie une erreur ailleurs.
macro_rules! windows_only {
    ($body:expr) => {{
        #[cfg(windows)]
        {
            $body
        }
        #[cfg(not(windows))]
        {
            Err::<_, String>(NOT_WINDOWS.into())
        }
    }};
}

#[tauri::command]
async fn radios_state() -> Result<serde_json::Value, String> {
    windows_only!(win::radios::state().map(|r| serde_json::to_value(r).unwrap_or_default()))
}

#[tauri::command]
async fn radio_set(kind: String, on: bool) -> Result<(), String> {
    let _ = (&kind, on);
    windows_only!(win::radios::set(&kind, on))
}

#[tauri::command]
async fn wifi_networks() -> Result<serde_json::Value, String> {
    windows_only!(win::radios::networks().map(|n| serde_json::to_value(n).unwrap_or_default()))
}

#[tauri::command]
async fn wifi_connect(profile: String) -> Result<(), String> {
    let _ = &profile;
    windows_only!(win::radios::connect(&profile))
}

#[tauri::command]
async fn media_now() -> Result<serde_json::Value, String> {
    windows_only!(win::media::now_playing().map(|m| serde_json::to_value(m).unwrap_or_default()))
}

#[tauri::command]
async fn media_control(action: String) -> Result<(), String> {
    let _ = &action;
    windows_only!(win::media::control(&action))
}

/* ---------------------------------------------------------------------
   Lanceur : fichiers
   --------------------------------------------------------------------- */

#[tauri::command]
async fn files_search(query: String) -> serde_json::Value {
    #[cfg(windows)]
    {
        serde_json::to_value(win::files::search(&query, 8)).unwrap_or_default()
    }
    #[cfg(not(windows))]
    {
        let _ = query;
        serde_json::Value::Array(Vec::new())
    }
}

#[tauri::command]
async fn files_recent() -> serde_json::Value {
    #[cfg(windows)]
    {
        serde_json::to_value(win::files::recent(6)).unwrap_or_default()
    }
    #[cfg(not(windows))]
    {
        serde_json::Value::Array(Vec::new())
    }
}

#[tauri::command]
fn open_file(app: AppHandle, path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        if !win::files::is_openable(&path) {
            return Err("Fichier hors des dossiers personnels.".into());
        }
        app.opener().open_path(&path, None::<&str>).map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, path);
        Err(NOT_WINDOWS.into())
    }
}

/* ---------------------------------------------------------------------
   Fenêtres : miniatures en direct et ancrage
   --------------------------------------------------------------------- */

#[cfg(windows)]
fn main_hwnd(app: &AppHandle) -> Option<isize> {
    app.get_webview_window("main")?.hwnd().ok().map(|h| h.0 as isize)
}

#[tauri::command]
fn set_thumbnails(app: AppHandle, slots: serde_json::Value) -> Result<(), String> {
    #[cfg(windows)]
    {
        let slots: Vec<win::thumbs::Slot> = serde_json::from_value(slots).map_err(|e| e.to_string())?;
        let dest = main_hwnd(&app).ok_or("Fenêtre principale introuvable.")?;
        win::thumbs::set(dest, slots);
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, slots);
        Ok(())
    }
}

#[tauri::command]
fn clear_thumbnails() {
    #[cfg(windows)]
    win::thumbs::clear();
}

#[tauri::command]
fn snap_window(id: i64, mode: String) -> Result<(), String> {
    let _ = (id, &mode);
    windows_only!(win::thumbs::snap(id, &mode))
}

/* ---------------------------------------------------------------------
   Quick Insert
   --------------------------------------------------------------------- */

#[tauri::command]
fn qi_history() -> Vec<String> {
    #[cfg(windows)]
    {
        win::quick::history()
    }
    #[cfg(not(windows))]
    {
        Vec::new()
    }
}

#[tauri::command]
fn qi_clear() {
    #[cfg(windows)]
    win::quick::clear_history();
}

#[tauri::command]
async fn qi_insert(app: AppHandle, text: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("quickinsert") {
        let _ = w.hide();
    }
    let _ = &text;
    windows_only!(win::quick::insert(&text))
}

#[tauri::command]
async fn qi_screenshots() -> serde_json::Value {
    #[cfg(windows)]
    {
        serde_json::to_value(win::quick::screenshots()).unwrap_or_default()
    }
    #[cfg(not(windows))]
    {
        serde_json::Value::Array(Vec::new())
    }
}

#[tauri::command]
async fn qi_insert_image(app: AppHandle, path: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("quickinsert") {
        let _ = w.hide();
    }
    let _ = &path;
    windows_only!(win::quick::insert_image(&path))
}

#[tauri::command]
fn qi_dictate(app: AppHandle) {
    if let Some(w) = app.get_webview_window("quickinsert") {
        let _ = w.hide();
    }
    #[cfg(windows)]
    win::quick::dictate();
}

#[tauri::command]
fn qi_close(app: AppHandle) {
    if let Some(w) = app.get_webview_window("quickinsert") {
        let _ = w.hide();
    }
    #[cfg(windows)]
    win::quick::return_focus();
}

#[tauri::command]
async fn get_brightness() -> Option<u8> {
    #[cfg(windows)]
    {
        win::system::brightness()
    }
    #[cfg(not(windows))]
    {
        None
    }
}

#[tauri::command]
async fn set_brightness(level: u8) -> Result<(), String> {
    #[cfg(windows)]
    {
        win::system::set_brightness(level)
    }
    #[cfg(not(windows))]
    {
        let _ = level;
        Err(NOT_WINDOWS.into())
    }
}

/* ---------------------------------------------------------------------
   Mode Googlebook (réglages Windows, réversibles)
   --------------------------------------------------------------------- */

#[tauri::command]
fn googlebook_status() -> bool {
    #[cfg(windows)]
    {
        win::settings::is_applied()
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[tauri::command]
async fn googlebook_apply(options: serde_json::Value) -> Result<(), String> {
    #[cfg(windows)]
    {
        let opts: win::settings::Options = serde_json::from_value(options).map_err(|e| e.to_string())?;
        win::settings::apply(opts)
    }
    #[cfg(not(windows))]
    {
        let _ = options;
        Err(NOT_WINDOWS.into())
    }
}

#[tauri::command]
async fn googlebook_restore() -> Result<bool, String> {
    #[cfg(windows)]
    {
        Ok(win::settings::restore())
    }
    #[cfg(not(windows))]
    {
        Err(NOT_WINDOWS.into())
    }
}

/* ---------------------------------------------------------------------
   Quick Insert, Magic Pointer, Glowbar
   --------------------------------------------------------------------- */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Features {
    quick_insert: bool,
    magic_pointer: bool,
    glowbar: bool,
    #[serde(default = "yes")]
    windows_key: bool,
}

fn yes() -> bool {
    true
}

#[tauri::command]
fn set_features(app: AppHandle, features: Features) {
    #[cfg(windows)]
    {
        use std::sync::atomic::Ordering;
        win::input::QUICK_INSERT.store(features.quick_insert, Ordering::Relaxed);
        win::input::MAGIC_POINTER.store(features.magic_pointer, Ordering::Relaxed);
        win::input::WINDOWS_KEY.store(features.windows_key, Ordering::Relaxed);
    }
    #[cfg(not(windows))]
    let _ = (features.quick_insert, features.magic_pointer, features.windows_key);
    if let Some(glow) = app.get_webview_window("glow") {
        let _ = if features.glowbar { glow.show() } else { glow.hide() };
    }
}

fn glow(app: &AppHandle, mode: &str) {
    let _ = app.emit_to("glow", "glow", mode);
}

#[tauri::command]
fn hide_bubble(app: AppHandle) {
    if let Some(b) = app.get_webview_window("bubble") {
        let _ = b.hide();
    }
    glow(&app, "pulse-off");
}

/// Ouvre la bulle « Demander à Gemini » près du pointeur (coordonnées physiques).
fn show_bubble(app: &AppHandle, x: i32, y: i32) {
    let Some(bubble) = app.get_webview_window("bubble") else { return };
    let size = bubble.outer_size().unwrap_or(PhysicalSize::new(460, 80));
    let (mut px, mut py) = (x + 14, y + 18);
    if let Ok(Some(m)) = app.monitor_from_point(x as f64, y as f64) {
        let (mx, my) = (m.position().x, m.position().y);
        let (mw, mh) = (m.size().width as i32, m.size().height as i32);
        px = px.clamp(mx + 8, mx + mw - size.width as i32 - 8);
        py = py.clamp(my + 8, my + mh - size.height as i32 - 8);
    }
    let _ = bubble.set_position(PhysicalPosition::new(px, py));
    let _ = bubble.show();
    let _ = bubble.set_focus();
    let _ = app.emit_to("bubble", "bubble-open", ());
    glow(app, "pulse-on");
}

/// Ouvre le lanceur d'OpenBook, avec une recherche déjà saisie (depuis Quick Insert).
#[tauri::command]
fn show_launcher(app: AppHandle, query: Option<String>) {
    if let Some(w) = app.get_webview_window("quickinsert") {
        let _ = w.hide();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
    }
    let _ = app.emit_to("main", "launcher", query.unwrap_or_default());
}

/// OpenBook passe devant et reçoit `event` (« launcher » ou « overview »).
fn front(app: &AppHandle, event: &str) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
    }
    let _ = app.emit_to("main", event, ());
}

/// Verr. Maj : Quick Insert s'ouvre près du curseur texte de l'appli active.
#[cfg(windows)]
fn open_quick_insert(app: &AppHandle) {
    let Some(qi) = app.get_webview_window("quickinsert") else { return };
    if qi.is_visible().unwrap_or(false) {
        let _ = qi.hide();
        win::quick::return_focus();
        return;
    }
    let own: Vec<isize> = ["main", "bubble", "glow", "quickinsert"]
        .iter()
        .filter_map(|l| app.get_webview_window(l)?.hwnd().ok().map(|h| h.0 as isize))
        .collect();
    let (x, y) = win::quick::capture_target(&own);
    let size = qi.outer_size().unwrap_or(PhysicalSize::new(440, 480));
    let (mut px, mut py) = (x, y + 8);
    if let Ok(Some(m)) = app.monitor_from_point(x as f64, y as f64) {
        let (mx, my) = (m.position().x, m.position().y);
        let (mw, mh) = (m.size().width as i32, m.size().height as i32);
        if py + size.height as i32 > my + mh - 8 {
            py = y - size.height as i32 - 28; // au-dessus du curseur
        }
        px = px.clamp(mx + 8, mx + mw - size.width as i32 - 8);
        py = py.clamp(my + 8, my + mh - size.height as i32 - 8);
    }
    let _ = qi.set_position(PhysicalPosition::new(px, py));
    let _ = qi.show();
    let _ = qi.set_focus();
    let _ = app.emit_to("quickinsert", "qi-open", ());
}

/// La Glowbar : une fine bande transparente en haut de l'écran principal,
/// toujours au premier plan, que les clics traversent.
fn setup_glowbar(app: &AppHandle) {
    let Some(glow) = app.get_webview_window("glow") else { return };
    let _ = glow.set_ignore_cursor_events(true);
    if let Ok(Some(m)) = glow.primary_monitor() {
        let height = (10.0 * m.scale_factor()).round() as u32;
        let _ = glow.set_position(*m.position());
        let _ = glow.set_size(PhysicalSize::new(m.size().width, height));
    }
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

/// Une seule instance : si OpenBook tourne déjà, on le ramène devant.
#[cfg(windows)]
fn already_running() -> bool {
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
    use windows_sys::Win32::System::Threading::CreateMutexW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{FindWindowW, SetForegroundWindow, ShowWindow, SW_RESTORE};
    unsafe {
        let name = win::wide("Local\\OpenBook.SingleInstance");
        let handle = CreateMutexW(std::ptr::null(), 0, name.as_ptr());
        if !handle.is_null() && GetLastError() == ERROR_ALREADY_EXISTS {
            let hwnd = FindWindowW(std::ptr::null(), win::wide("OpenBook").as_ptr());
            if !hwnd.is_null() {
                ShowWindow(hwnd, SW_RESTORE);
                SetForegroundWindow(hwnd);
            }
            return true;
        }
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // `OpenBook.exe --restore` : remet Windows comme avant (utilisé par la
    // désinstallation), sans ouvrir l'interface.
    if std::env::args().any(|a| a == "--restore") {
        #[cfg(windows)]
        win::settings::restore();
        return;
    }
    #[cfg(windows)]
    if already_running() {
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            open_app,
            open_files,
            open_settings,
            list_windows_apps,
            launch_windows_app,
            app_icons,
            list_windows,
            focus_window,
            close_window,
            power,
            copy_text,
            volume_get,
            volume_set,
            radios_state,
            radio_set,
            wifi_networks,
            wifi_connect,
            media_now,
            media_control,
            files_search,
            files_recent,
            open_file,
            set_thumbnails,
            clear_thumbnails,
            snap_window,
            qi_history,
            qi_clear,
            qi_insert,
            qi_close,
            qi_screenshots,
            qi_insert_image,
            qi_dictate,
            show_launcher,
            get_brightness,
            set_brightness,
            googlebook_status,
            googlebook_apply,
            googlebook_restore,
            set_features,
            hide_bubble,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            keep_as_home(handle.clone());
            setup_glowbar(&handle);
            #[cfg(windows)]
            {
                win::files::start_indexer();
                win::quick::watch_clipboard();
                let h = handle.clone();
                win::input::watch_keys(move |key| {
                    let h2 = h.clone();
                    let _ = h.run_on_main_thread(move || match key {
                        win::input::Hotkey::QuickInsert => open_quick_insert(&h2),
                        win::input::Hotkey::Launcher => front(&h2, "launcher"),
                        win::input::Hotkey::Overview => front(&h2, "overview"),
                    });
                });
                let h = handle.clone();
                win::input::watch_shake(move |x, y| {
                    let h2 = h.clone();
                    let _ = h.run_on_main_thread(move || show_bubble(&h2, x, y));
                });
            }
            #[cfg(not(windows))]
            let _ = (front as fn(&AppHandle, &str), show_bubble as fn(&AppHandle, i32, i32));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("impossible de démarrer OpenBook");
}
