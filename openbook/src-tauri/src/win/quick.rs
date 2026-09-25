//! Quick Insert : historique du presse-papiers (en mémoire seulement),
//! position du curseur texte et insertion dans l'appli active.

use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use windows_sys::Win32::Foundation::{HWND, POINT};
use windows_sys::Win32::Graphics::Gdi::ClientToScreen;
use windows_sys::Win32::System::DataExchange::{
    CloseClipboard, GetClipboardData, GetClipboardSequenceNumber, IsClipboardFormatAvailable, OpenClipboard,
};
use windows_sys::Win32::System::Memory::{GlobalLock, GlobalUnlock};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_CONTROL, VK_V,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, GetForegroundWindow, GetGUIThreadInfo, GetWindowThreadProcessId, SetForegroundWindow,
    GUITHREADINFO,
};

const CF_UNICODETEXT: u32 = 13;
const MAX_ITEMS: usize = 25;

static HISTORY: Mutex<Vec<String>> = Mutex::new(Vec::new());
pub static RECORD: AtomicBool = AtomicBool::new(true);
static TARGET: AtomicIsize = AtomicIsize::new(0);

fn read_clipboard_text() -> Option<String> {
    unsafe {
        if IsClipboardFormatAvailable(CF_UNICODETEXT) == 0 || OpenClipboard(std::ptr::null_mut()) == 0 {
            return None;
        }
        let mut out = None;
        let h = GetClipboardData(CF_UNICODETEXT);
        if !h.is_null() {
            let p = GlobalLock(h) as *const u16;
            if !p.is_null() {
                let mut len = 0usize;
                while *p.add(len) != 0 && len < 20_000 {
                    len += 1;
                }
                out = Some(String::from_utf16_lossy(std::slice::from_raw_parts(p, len)));
                GlobalUnlock(h);
            }
        }
        CloseClipboard();
        out
    }
}

/// Surveille le presse-papiers et garde les 25 derniers textes copiés.
pub fn watch_clipboard() {
    std::thread::spawn(|| {
        let mut last = unsafe { GetClipboardSequenceNumber() };
        loop {
            std::thread::sleep(Duration::from_millis(600));
            let seq = unsafe { GetClipboardSequenceNumber() };
            if seq == last {
                continue;
            }
            last = seq;
            if !RECORD.load(Ordering::Relaxed) {
                continue;
            }
            if let Some(text) = read_clipboard_text() {
                let t = text.trim();
                if t.is_empty() || t.len() > 10_000 {
                    continue;
                }
                let mut h = HISTORY.lock().unwrap_or_else(|e| e.into_inner());
                h.retain(|x| x != &text);
                h.insert(0, text);
                h.truncate(MAX_ITEMS);
            }
        }
    });
}

pub fn history() -> Vec<String> {
    HISTORY.lock().map(|h| h.clone()).unwrap_or_default()
}

pub fn clear_history() {
    if let Ok(mut h) = HISTORY.lock() {
        h.clear();
    }
}

/// Retient l'appli active et renvoie la position du curseur texte
/// (ou de la souris à défaut), en pixels écran.
pub fn capture_target(own: &[isize]) -> (i32, i32) {
    unsafe {
        let fg = GetForegroundWindow();
        if !own.contains(&(fg as isize)) {
            TARGET.store(fg as isize, Ordering::Relaxed);
        }
        let thread = GetWindowThreadProcessId(fg, std::ptr::null_mut());
        let mut info: GUITHREADINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<GUITHREADINFO>() as u32;
        if GetGUIThreadInfo(thread, &mut info) != 0 && !info.hwndCaret.is_null() {
            let mut p = POINT { x: info.rcCaret.left, y: info.rcCaret.bottom };
            ClientToScreen(info.hwndCaret, &mut p);
            if p.x != 0 || p.y != 0 {
                return (p.x, p.y);
            }
        }
        let mut p = POINT { x: 0, y: 0 };
        GetCursorPos(&mut p);
        (p.x, p.y)
    }
}

fn key(vk: u16, up: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT { wVk: vk, wScan: 0, dwFlags: if up { KEYEVENTF_KEYUP } else { 0 }, time: 0, dwExtraInfo: 0 },
        },
    }
}

/* ---------- Captures d'écran récentes ---------- */

#[derive(serde::Serialize)]
pub struct Shot {
    pub path: String,
    pub name: String,
    pub thumb: String,
}

fn screenshot_dirs() -> Vec<std::path::PathBuf> {
    let Some(home) = std::env::var_os("USERPROFILE").map(std::path::PathBuf::from) else { return Vec::new() };
    vec![home.join(r"Pictures\Screenshots"), home.join(r"OneDrive\Pictures\Screenshots")]
}

/// Décode un PNG 8 bits en RGBA.
fn decode_png(path: &std::path::Path) -> Option<(u32, u32, Vec<u8>)> {
    let file = std::fs::File::open(path).ok()?;
    let mut decoder = png::Decoder::new(std::io::BufReader::new(file));
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let mut reader = decoder.read_info().ok()?;
    let mut buf = vec![0u8; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buf).ok()?;
    let (w, h) = (info.width, info.height);
    let rgba = match info.color_type {
        png::ColorType::Rgba => buf[..(w * h * 4) as usize].to_vec(),
        png::ColorType::Rgb => buf[..(w * h * 3) as usize].chunks_exact(3).flat_map(|p| [p[0], p[1], p[2], 255]).collect(),
        png::ColorType::GrayscaleAlpha => buf[..(w * h * 2) as usize].chunks_exact(2).flat_map(|p| [p[0], p[0], p[0], p[1]]).collect(),
        png::ColorType::Grayscale => buf[..(w * h) as usize].iter().flat_map(|&g| [g, g, g, 255]).collect(),
        _ => return None,
    };
    Some((w, h, rgba))
}

fn thumbnail(w: u32, h: u32, rgba: &[u8], max_w: u32) -> Option<String> {
    use base64::Engine;
    let tw = max_w.min(w).max(1);
    let th = ((h as u64 * tw as u64) / w as u64).max(1) as u32;
    let mut out = Vec::with_capacity((tw * th * 4) as usize);
    for y in 0..th {
        let sy = (y as u64 * h as u64 / th as u64) as u32;
        for x in 0..tw {
            let sx = (x as u64 * w as u64 / tw as u64) as u32;
            let i = ((sy * w + sx) * 4) as usize;
            out.extend_from_slice(&rgba[i..i + 4]);
        }
    }
    let mut bytes = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut bytes, tw, th);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        let mut writer = enc.write_header().ok()?;
        writer.write_image_data(&out).ok()?;
    }
    Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

/// Les 6 dernières captures d'écran (dossier Images\Screenshots), avec miniature.
pub fn screenshots() -> Vec<Shot> {
    let mut files: Vec<(std::time::SystemTime, std::path::PathBuf)> = screenshot_dirs()
        .iter()
        .filter_map(|d| std::fs::read_dir(d).ok())
        .flatten()
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x.eq_ignore_ascii_case("png")))
        .filter_map(|e| Some((e.metadata().ok()?.modified().ok()?, e.path())))
        .collect();
    files.sort_by(|a, b| b.0.cmp(&a.0));
    files
        .into_iter()
        .take(6)
        .filter_map(|(_, path)| {
            let (w, h, rgba) = decode_png(&path)?;
            Some(Shot {
                name: path.file_stem()?.to_string_lossy().to_string(),
                thumb: thumbnail(w, h, &rgba, 220)?,
                path: path.to_string_lossy().to_string(),
            })
        })
        .collect()
}

fn is_screenshot(path: &str) -> bool {
    let Ok(canon) = std::path::Path::new(path).canonicalize() else { return false };
    screenshot_dirs().iter().filter_map(|d| d.canonicalize().ok()).any(|d| canon.starts_with(d))
}

/// Met une image dans le presse-papiers au format CF_DIB.
fn copy_image(w: u32, h: u32, rgba: &[u8]) -> Result<(), String> {
    use windows_sys::Win32::Foundation::GlobalFree;
    use windows_sys::Win32::Graphics::Gdi::{BITMAPINFOHEADER, BI_RGB};
    use windows_sys::Win32::System::DataExchange::{EmptyClipboard, SetClipboardData};
    use windows_sys::Win32::System::Memory::{GlobalAlloc, GMEM_MOVEABLE};
    const CF_DIB: u32 = 8;
    let header = BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: w as i32,
        biHeight: h as i32, // de bas en haut
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB,
        biSizeImage: w * h * 4,
        biXPelsPerMeter: 0,
        biYPelsPerMeter: 0,
        biClrUsed: 0,
        biClrImportant: 0,
    };
    let hsize = std::mem::size_of::<BITMAPINFOHEADER>();
    let total = hsize + (w * h * 4) as usize;
    unsafe {
        if OpenClipboard(std::ptr::null_mut()) == 0 {
            return Err("Presse-papiers occupé.".into());
        }
        EmptyClipboard();
        let mem = GlobalAlloc(GMEM_MOVEABLE, total);
        if mem.is_null() {
            CloseClipboard();
            return Err("Mémoire insuffisante.".into());
        }
        let dst = GlobalLock(mem) as *mut u8;
        std::ptr::copy_nonoverlapping((&header as *const BITMAPINFOHEADER).cast::<u8>(), dst, hsize);
        let px = dst.add(hsize);
        for y in 0..h {
            let src_row = ((h - 1 - y) * w * 4) as usize;
            for x in 0..w as usize {
                let s = src_row + x * 4;
                let d = (y * w * 4) as usize + x * 4;
                *px.add(d) = rgba[s + 2];
                *px.add(d + 1) = rgba[s + 1];
                *px.add(d + 2) = rgba[s];
                *px.add(d + 3) = rgba[s + 3];
            }
        }
        GlobalUnlock(mem);
        let ok = !SetClipboardData(CF_DIB, mem).is_null();
        if !ok {
            GlobalFree(mem);
        }
        CloseClipboard();
        if ok {
            Ok(())
        } else {
            Err("Copie de l'image impossible.".into())
        }
    }
}

fn paste_into_target() {
    unsafe {
        let target = TARGET.load(Ordering::Relaxed) as HWND;
        if !target.is_null() {
            SetForegroundWindow(target);
        }
    }
    std::thread::sleep(Duration::from_millis(120));
    let inputs = [key(VK_CONTROL, false), key(VK_V, false), key(VK_V, true), key(VK_CONTROL, true)];
    unsafe {
        SendInput(inputs.len() as u32, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);
    }
}

/// Colle une capture d'écran dans l'appli d'origine.
pub fn insert_image(path: &str) -> Result<(), String> {
    if !is_screenshot(path) {
        return Err("Capture introuvable.".into());
    }
    let (w, h, rgba) = decode_png(std::path::Path::new(path)).ok_or("Image illisible.")?;
    RECORD.store(false, Ordering::Relaxed);
    copy_image(w, h, &rgba)?;
    paste_into_target();
    std::thread::spawn(|| {
        std::thread::sleep(Duration::from_millis(1200));
        RECORD.store(true, Ordering::Relaxed);
    });
    Ok(())
}

/// Dictée : l'appli d'origine reprend la main et la saisie vocale de Windows
/// (Win+H) s'ouvre, comme Rambler sur un Googlebook.
pub fn dictate() {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{VK_H, VK_LWIN};
    return_focus();
    std::thread::sleep(Duration::from_millis(150));
    let inputs = [key(VK_LWIN, false), key(VK_H, false), key(VK_H, true), key(VK_LWIN, true)];
    unsafe {
        SendInput(inputs.len() as u32, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);
    }
}

/// Rend la main à l'appli d'origine et y colle `text` (Ctrl+V simulé).
/// Le contenu précédent du presse-papiers est remis ensuite.
pub fn insert(text: &str) -> Result<(), String> {
    let previous = read_clipboard_text();
    RECORD.store(false, Ordering::Relaxed);
    super::system::copy_text(text)?;
    paste_into_target();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(500));
        if let Some(prev) = previous {
            let _ = super::system::copy_text(&prev);
        }
        std::thread::sleep(Duration::from_millis(700));
        RECORD.store(true, Ordering::Relaxed);
    });
    Ok(())
}

/// Ferme Quick Insert sans rien insérer : l'appli d'origine reprend la main.
pub fn return_focus() {
    unsafe {
        let target = TARGET.load(Ordering::Relaxed) as HWND;
        if !target.is_null() {
            SetForegroundWindow(target);
        }
    }
}
