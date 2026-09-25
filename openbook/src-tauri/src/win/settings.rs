//! « Mode Googlebook » : applique à Windows le thème d'OpenBook
//! (clair/sombre, couleur d'accent, fond d'écran, barre des tâches masquée)
//! en sauvegardant d'abord les valeurs d'origine. `restore` remet tout exactement comme avant.

use std::path::PathBuf;
use std::ptr::null_mut;

use base64::Engine;
use serde::{Deserialize, Serialize};
use windows_sys::Win32::Foundation::{LPARAM, WPARAM};
use windows_sys::Win32::UI::Shell::{SHAppBarMessage, ABM_GETSTATE, ABM_SETSTATE, APPBARDATA};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    FindWindowW, SendMessageTimeoutW, SystemParametersInfoW, HWND_BROADCAST, SMTO_ABORTIFHUNG,
    SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SPI_GETDESKWALLPAPER, SPI_SETDESKWALLPAPER, WM_SETTINGCHANGE,
};

use super::reg::{self, Raw};
use super::{from_wide, wide};

const PERSONALIZE: &str = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
const ACCENT: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\Accent";
const DWM: &str = r"Software\Microsoft\Windows\DWM";
const DESKTOP: &str = r"Control Panel\Desktop";
const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

const ABS_AUTOHIDE: u32 = 0x1;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    pub theme: bool,
    pub dark: bool,
    /// 8 couleurs « #rrggbb » : palette d'accent, du plus clair au plus foncé.
    pub palette: Vec<String>,
    pub accent: bool,
    /// PNG encodé en base64 (sans préfixe data:).
    pub wallpaper: Option<String>,
    pub autohide: bool,
    /// Ouvrir OpenBook à l'ouverture de session (demandé explicitement par l'utilisateur).
    #[serde(default)]
    pub autostart: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Saved {
    path: String,
    name: String,
    value: Option<Raw>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Backup {
    values: Vec<Saved>,
    wallpaper: Option<String>,
    taskbar_state: Option<u32>,
}

impl Backup {
    /// Mémorise la valeur d'origine, une seule fois.
    fn remember(&mut self, path: &str, name: &str) {
        if !self.values.iter().any(|s| s.path == path && s.name == name) {
            self.values.push(Saved { path: path.into(), name: name.into(), value: reg::get(path, name) });
        }
    }
}

pub fn data_dir() -> PathBuf {
    let base = std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
    base.join("fr.graineos.openbook")
}

fn backup_file() -> PathBuf {
    data_dir().join("googlebook-backup.json")
}

fn load() -> Option<Backup> {
    let text = std::fs::read_to_string(backup_file()).ok()?;
    serde_json::from_str(&text).ok()
}

fn store(b: &Backup) -> Result<(), String> {
    std::fs::create_dir_all(data_dir()).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(b).map_err(|e| e.to_string())?;
    std::fs::write(backup_file(), text).map_err(|e| e.to_string())
}

pub fn is_applied() -> bool {
    backup_file().is_file()
}

fn parse_hex(s: &str) -> Option<(u8, u8, u8)> {
    let h = s.trim_start_matches('#');
    if h.len() != 6 {
        return None;
    }
    let v = u32::from_str_radix(h, 16).ok()?;
    Some(((v >> 16) as u8, (v >> 8) as u8, v as u8))
}

/// Couleur au format ABGR (0xFFBBGGRR) utilisé par Explorer et DWM.
fn abgr((r, g, b): (u8, u8, u8)) -> u32 {
    0xFF00_0000 | (b as u32) << 16 | (g as u32) << 8 | r as u32
}

fn broadcast() {
    for area in ["ImmersiveColorSet", "WindowsThemeElement"] {
        let w = wide(area);
        unsafe {
            SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_SETTINGCHANGE,
                0 as WPARAM,
                w.as_ptr() as LPARAM,
                SMTO_ABORTIFHUNG,
                300,
                null_mut(),
            );
        }
    }
}

fn current_wallpaper() -> String {
    let mut buf = [0u16; 1024];
    unsafe {
        SystemParametersInfoW(SPI_GETDESKWALLPAPER, buf.len() as u32, buf.as_mut_ptr().cast(), 0);
    }
    from_wide(&buf)
}

fn set_wallpaper(path: &str) -> bool {
    let mut w = wide(path);
    unsafe {
        SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, w.as_mut_ptr().cast(), SPIF_UPDATEINIFILE | SPIF_SENDCHANGE) != 0
    }
}

fn appbar() -> APPBARDATA {
    let mut data: APPBARDATA = unsafe { std::mem::zeroed() };
    data.cbSize = std::mem::size_of::<APPBARDATA>() as u32;
    data.hWnd = unsafe { FindWindowW(wide("Shell_TrayWnd").as_ptr(), std::ptr::null()) };
    data
}

fn taskbar_state() -> u32 {
    let mut data = appbar();
    unsafe { SHAppBarMessage(ABM_GETSTATE, &mut data) as u32 }
}

fn set_taskbar_state(state: u32) {
    let mut data = appbar();
    data.lParam = state as LPARAM;
    unsafe {
        SHAppBarMessage(ABM_SETSTATE, &mut data);
    }
}

fn restore_backup(b: Backup) {
    for s in b.values.into_iter().rev() {
        match s.value {
            Some(raw) => {
                reg::set(&s.path, &s.name, raw.kind, &raw.data);
            }
            None => reg::delete(&s.path, &s.name),
        }
    }
    if let Some(w) = b.wallpaper {
        set_wallpaper(&w);
    }
    if let Some(state) = b.taskbar_state {
        set_taskbar_state(state);
    }
    broadcast();
}

/// Remet Windows comme avant OpenBook. Renvoie false s'il n'y avait rien à restaurer.
pub fn restore() -> bool {
    match load() {
        Some(b) => {
            restore_backup(b);
            let _ = std::fs::remove_file(backup_file());
            true
        }
        None => false,
    }
}

pub fn apply(opts: Options) -> Result<(), String> {
    // On repart toujours des réglages d'origine : décocher une option
    // puis réappliquer la remet donc bien comme avant.
    if let Some(old) = load() {
        restore_backup(old);
        let _ = std::fs::remove_file(backup_file());
    }
    let mut b = Backup::default();

    if opts.theme {
        let light = if opts.dark { 0 } else { 1 };
        for name in ["AppsUseLightTheme", "SystemUsesLightTheme", "EnableTransparency"] {
            b.remember(PERSONALIZE, name);
        }
        reg::set_dword(PERSONALIZE, "AppsUseLightTheme", light);
        reg::set_dword(PERSONALIZE, "SystemUsesLightTheme", light);
        reg::set_dword(PERSONALIZE, "EnableTransparency", 1);
    }

    if opts.accent {
        let colors: Vec<(u8, u8, u8)> = opts.palette.iter().filter_map(|c| parse_hex(c)).collect();
        if colors.len() != 8 {
            return Err("Palette d'accent invalide.".into());
        }
        for (path, name) in [
            (ACCENT, "AccentPalette"),
            (ACCENT, "AccentColorMenu"),
            (ACCENT, "StartColorMenu"),
            (DWM, "AccentColor"),
            (DWM, "ColorizationColor"),
            (DWM, "ColorizationAfterglow"),
            (DESKTOP, "AutoColorization"),
        ] {
            b.remember(path, name);
        }
        let palette: Vec<u8> = colors.iter().flat_map(|&(r, g, bl)| [r, g, bl, 0]).collect();
        reg::set(ACCENT, "AccentPalette", windows_sys::Win32::System::Registry::REG_BINARY, &palette);
        reg::set_dword(ACCENT, "AccentColorMenu", abgr(colors[3]));
        reg::set_dword(ACCENT, "StartColorMenu", abgr(colors[4]));
        reg::set_dword(DWM, "AccentColor", abgr(colors[3]));
        let (r, g, bl) = colors[3];
        let argb = 0xC400_0000 | (r as u32) << 16 | (g as u32) << 8 | bl as u32;
        reg::set_dword(DWM, "ColorizationColor", argb);
        reg::set_dword(DWM, "ColorizationAfterglow", argb);
        // Désactive « couleur d'accent automatique depuis le fond d'écran »,
        // en gardant le type de valeur utilisé par cette version de Windows.
        match reg::get(DESKTOP, "AutoColorization") {
            Some(raw) if raw.kind == windows_sys::Win32::System::Registry::REG_DWORD => {
                reg::set_dword(DESKTOP, "AutoColorization", 0);
            }
            _ => {
                reg::set_sz(DESKTOP, "AutoColorization", "0");
            }
        }
    }

    if let Some(png) = opts.wallpaper.as_deref() {
        let bytes = base64::engine::general_purpose::STANDARD.decode(png).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(data_dir()).map_err(|e| e.to_string())?;
        let file = data_dir().join("googlebook-wallpaper.png");
        std::fs::write(&file, bytes).map_err(|e| e.to_string())?;
        b.wallpaper = Some(current_wallpaper());
        b.remember(DESKTOP, "WallpaperStyle");
        b.remember(DESKTOP, "TileWallpaper");
        reg::set_sz(DESKTOP, "WallpaperStyle", "10");
        reg::set_sz(DESKTOP, "TileWallpaper", "0");
        set_wallpaper(&file.to_string_lossy());
    }

    if opts.autohide {
        let state = taskbar_state();
        b.taskbar_state = Some(state);
        set_taskbar_state(state | ABS_AUTOHIDE);
    }

    if opts.autostart {
        b.remember(RUN, "OpenBook");
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        reg::set_sz(RUN, "OpenBook", &format!("\"{}\" --autostart", exe.display()));
    }

    broadcast();
    store(&b)
}
