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

/// Rend la main à l'appli d'origine et y colle `text` (Ctrl+V simulé).
/// Le contenu précédent du presse-papiers est remis ensuite.
pub fn insert(text: &str) -> Result<(), String> {
    let previous = read_clipboard_text();
    RECORD.store(false, Ordering::Relaxed);
    super::system::copy_text(text)?;
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
