//! Applis Windows installées (raccourcis du menu Démarrer) et leurs icônes.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::ptr::null_mut;

use base64::Engine;
use serde::Serialize;
use windows_sys::core::GUID;
use windows_sys::Win32::Graphics::Gdi::{
    DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
    DIB_RGB_COLORS,
};
use windows_sys::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
use windows_sys::Win32::UI::Controls::{ImageList_GetIcon, HIMAGELIST, ILD_TRANSPARENT};
use windows_sys::Win32::UI::Shell::{SHGetFileInfoW, SHGetImageList, SHFILEINFOW, SHGFI_SYSICONINDEX, SHIL_EXTRALARGE};
use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};

use super::wide;

#[derive(Clone, Debug, Serialize)]
pub struct WinApp {
    pub name: String,
    pub path: String,
}

/// Dossiers « Programmes » du menu Démarrer (utilisateur puis tous les utilisateurs).
pub fn start_menu_dirs() -> Vec<PathBuf> {
    let sub = r"Microsoft\Windows\Start Menu\Programs";
    ["APPDATA", "ProgramData"]
        .iter()
        .filter_map(|v| std::env::var_os(v))
        .map(|base| PathBuf::from(base).join(sub))
        .collect()
}

const SKIP: [&str; 9] = [
    "uninstall", "désinstall", "desinstall", "readme", "lisez-moi", "documentation", "release notes", "website", "help",
];

fn walk(dir: &Path, depth: u32, out: &mut Vec<WinApp>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth < 4 {
                walk(&path, depth + 1, out);
            }
        } else if path.extension().is_some_and(|e| e.eq_ignore_ascii_case("lnk")) {
            let Some(name) = path.file_stem().map(|s| s.to_string_lossy().to_string()) else { continue };
            let lower = name.to_lowercase();
            if SKIP.iter().any(|k| lower.contains(k)) {
                continue;
            }
            out.push(WinApp { name, path: path.to_string_lossy().to_string() });
        }
    }
}

pub fn scan() -> Vec<WinApp> {
    let mut all = Vec::new();
    for dir in start_menu_dirs() {
        walk(&dir, 0, &mut all);
    }
    let mut seen = std::collections::HashSet::new();
    all.retain(|a| seen.insert(a.name.to_lowercase()));
    all.sort_by_key(|a| a.name.to_lowercase());
    all
}

/// Vrai si le chemin est un raccourci situé dans un dossier du menu Démarrer.
pub fn is_start_menu_shortcut(path: &str) -> bool {
    let p = Path::new(path);
    let Ok(canon) = p.canonicalize() else { return false };
    p.extension().is_some_and(|e| e.eq_ignore_ascii_case("lnk"))
        && start_menu_dirs().iter().filter_map(|d| d.canonicalize().ok()).any(|d| canon.starts_with(d))
}

// {46EB5926-582E-4017-9FDF-E8998DAA0950}
const IID_IIMAGELIST: GUID = GUID::from_u128(0x46eb5926_582e_4017_9fdf_e8998daa0950);

unsafe fn hicon_to_png(hicon: HICON) -> Option<Vec<u8>> {
    let mut info: ICONINFO = std::mem::zeroed();
    if GetIconInfo(hicon, &mut info) == 0 {
        return None;
    }
    let result = (|| {
        if info.hbmColor.is_null() {
            return None;
        }
        let mut bm: BITMAP = std::mem::zeroed();
        if GetObjectW(info.hbmColor, std::mem::size_of::<BITMAP>() as i32, (&mut bm as *mut BITMAP).cast()) == 0 {
            return None;
        }
        let (w, h) = (bm.bmWidth, bm.bmHeight);
        if w <= 0 || h <= 0 || w > 512 || h > 512 {
            return None;
        }
        let mut bi: BITMAPINFO = std::mem::zeroed();
        bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bi.bmiHeader.biWidth = w;
        bi.bmiHeader.biHeight = -h; // lignes de haut en bas
        bi.bmiHeader.biPlanes = 1;
        bi.bmiHeader.biBitCount = 32;
        bi.bmiHeader.biCompression = BI_RGB;
        let mut buf = vec![0u8; (w * h * 4) as usize];
        let hdc = GetDC(null_mut());
        let lines = GetDIBits(hdc, info.hbmColor, 0, h as u32, buf.as_mut_ptr().cast(), &mut bi, DIB_RGB_COLORS);
        ReleaseDC(null_mut(), hdc);
        if lines == 0 {
            return None;
        }
        let has_alpha = buf.chunks_exact(4).any(|p| p[3] != 0);
        for p in buf.chunks_exact_mut(4) {
            p.swap(0, 2); // BGRA → RGBA
            if !has_alpha {
                p[3] = 255;
            }
        }
        let mut out = Vec::new();
        {
            let mut enc = png::Encoder::new(&mut out, w as u32, h as u32);
            enc.set_color(png::ColorType::Rgba);
            enc.set_depth(png::BitDepth::Eight);
            let mut writer = enc.write_header().ok()?;
            writer.write_image_data(&buf).ok()?;
        }
        Some(out)
    })();
    if !info.hbmColor.is_null() {
        DeleteObject(info.hbmColor);
    }
    if !info.hbmMask.is_null() {
        DeleteObject(info.hbmMask);
    }
    result
}

/// Icône 48 px d'un fichier (raccourci ou .exe), en PNG.
unsafe fn icon_png(path: &str) -> Option<Vec<u8>> {
    let mut sfi: SHFILEINFOW = std::mem::zeroed();
    let w = wide(path);
    if SHGetFileInfoW(w.as_ptr(), 0, &mut sfi, std::mem::size_of::<SHFILEINFOW>() as u32, SHGFI_SYSICONINDEX) == 0 {
        return None;
    }
    let mut list: *mut core::ffi::c_void = null_mut();
    if SHGetImageList(SHIL_EXTRALARGE as i32, &IID_IIMAGELIST, &mut list) < 0 || list.is_null() {
        return None;
    }
    let hicon = ImageList_GetIcon(list as HIMAGELIST, sfi.iIcon, ILD_TRANSPARENT);
    // IImageList::Release (3e entrée de la table virtuelle IUnknown).
    let vtbl = *(list as *const *const unsafe extern "system" fn(*mut core::ffi::c_void) -> u32);
    (*vtbl.add(2))(list);
    if hicon.is_null() {
        return None;
    }
    let png = hicon_to_png(hicon);
    DestroyIcon(hicon);
    png
}

/// Icônes de plusieurs fichiers ou dossiers, en URL data:, sur un thread COM dédié.
pub fn icons(paths: Vec<String>) -> HashMap<String, String> {
    std::thread::spawn(move || {
        let mut out = HashMap::new();
        unsafe {
            CoInitializeEx(std::ptr::null(), COINIT_APARTMENTTHREADED as u32);
            for p in paths {
                // Raccourcis, exécutables, documents ou dossiers : icône du shell.
                if !Path::new(&p).exists() {
                    continue;
                }
                if let Some(png) = icon_png(&p) {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(png);
                    out.insert(p, format!("data:image/png;base64,{b64}"));
                }
            }
            CoUninitialize();
        }
        out
    })
    .join()
    .unwrap_or_default()
}
