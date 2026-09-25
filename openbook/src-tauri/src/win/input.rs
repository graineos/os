//! Entrées globales :
//! - Quick Insert : Verr. Maj ouvre Quick Insert (Maj + Verr. Maj garde les
//!   majuscules).
//! - Touche Windows seule : lanceur OpenBook ; Win+Tab : Vue d'ensemble. Les
//!   autres raccourcis Windows (Win+E, Win+L…) restent intacts.
//!   Seules ces touches sont examinées ; aucune frappe n'est lue ni enregistrée.
//! - Magic Pointer : secouer la souris n'importe où ouvre la bulle Gemini.

use std::collections::VecDeque;
use std::ptr::null_mut;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use windows_sys::Win32::Foundation::{LPARAM, LRESULT, POINT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_CAPITAL, VK_LWIN,
    VK_RWIN, VK_SHIFT, VK_TAB,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetCursorPos, GetMessageW, SetWindowsHookExW, TranslateMessage, HC_ACTION,
    KBDLLHOOKSTRUCT, LLKHF_INJECTED, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
};

pub static QUICK_INSERT: AtomicBool = AtomicBool::new(true);
pub static MAGIC_POINTER: AtomicBool = AtomicBool::new(true);
/// Touche Windows seule → lanceur OpenBook, Win+Tab → Vue d'ensemble.
pub static WINDOWS_KEY: AtomicBool = AtomicBool::new(true);

#[derive(Clone, Copy, Debug)]
pub enum Hotkey {
    /// Verr. Maj (sans Maj) : Quick Insert.
    QuickInsert,
    /// Touche Windows appuyée seule : lanceur.
    Launcher,
    /// Win+Tab : Vue d'ensemble.
    Overview,
}

static SENDER: OnceLock<Sender<Hotkey>> = OnceLock::new();
static CAPS_DOWN: AtomicBool = AtomicBool::new(false);
static WIN_DOWN: AtomicBool = AtomicBool::new(false);
static WIN_COMBO: AtomicBool = AtomicBool::new(false);
static WIN_SWALLOWED: AtomicBool = AtomicBool::new(false);

/// Touche virtuelle non attribuée : glissée avant le relâchement de la touche
/// Windows pour que Windows n'ouvre pas le menu Démarrer.
const VK_MASK: u16 = 0xE8;

fn emit(h: Hotkey) {
    if let Some(tx) = SENDER.get() {
        let _ = tx.send(h);
    }
}

fn press(vk: u16, up: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT { wVk: vk, wScan: 0, dwFlags: if up { KEYEVENTF_KEYUP } else { 0 }, time: 0, dwExtraInfo: 0 },
        },
    }
}

unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 {
        let k = &*(lparam as *const KBDLLHOOKSTRUCT);
        let injected = k.flags & LLKHF_INJECTED != 0;
        let down = matches!(wparam as u32, WM_KEYDOWN | WM_SYSKEYDOWN);
        let up = matches!(wparam as u32, WM_KEYUP | WM_SYSKEYUP);
        let vk = k.vkCode as u16;

        // Verr. Maj → Quick Insert (Maj + Verr. Maj garde les majuscules).
        if vk == VK_CAPITAL && !injected && QUICK_INSERT.load(Ordering::Relaxed) && GetAsyncKeyState(VK_SHIFT as i32) >= 0 {
            if down && !CAPS_DOWN.swap(true, Ordering::Relaxed) {
                emit(Hotkey::QuickInsert);
            }
            if up {
                CAPS_DOWN.store(false, Ordering::Relaxed);
            }
            return 1;
        }

        if !injected && WINDOWS_KEY.load(Ordering::Relaxed) {
            let is_win = vk == VK_LWIN || vk == VK_RWIN;
            if is_win && down {
                if !WIN_DOWN.swap(true, Ordering::Relaxed) {
                    WIN_COMBO.store(false, Ordering::Relaxed);
                    WIN_SWALLOWED.store(false, Ordering::Relaxed);
                }
            } else if is_win && up {
                WIN_DOWN.store(false, Ordering::Relaxed);
                let alone = !WIN_COMBO.load(Ordering::Relaxed);
                if alone || WIN_SWALLOWED.load(Ordering::Relaxed) {
                    // Masque + relâchement réinjecté : le menu Démarrer ne s'ouvre pas.
                    let inputs = [press(VK_MASK, false), press(VK_MASK, true), press(vk, true)];
                    SendInput(inputs.len() as u32, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);
                    if alone {
                        emit(Hotkey::Launcher);
                    }
                    return 1;
                }
            } else if down && WIN_DOWN.load(Ordering::Relaxed) {
                WIN_COMBO.store(true, Ordering::Relaxed);
                if vk == VK_TAB {
                    WIN_SWALLOWED.store(true, Ordering::Relaxed);
                    emit(Hotkey::Overview);
                    return 1;
                }
            } else if up && vk == VK_TAB && WIN_SWALLOWED.load(Ordering::Relaxed) {
                return 1;
            }
        }
    }
    CallNextHookEx(null_mut(), code, wparam, lparam)
}

/// Appelle `on_key` pour chaque raccourci global d'OpenBook.
pub fn watch_keys(on_key: impl Fn(Hotkey) + Send + 'static) {
    let (tx, rx) = std::sync::mpsc::channel();
    if SENDER.set(tx).is_err() {
        return;
    }
    std::thread::spawn(move || {
        for h in rx {
            on_key(h);
        }
    });
    std::thread::spawn(|| unsafe {
        let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), GetModuleHandleW(std::ptr::null()), 0);
        if hook.is_null() {
            return;
        }
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    });
}

/// Détecte une secousse horizontale rapide du curseur (au moins 4 allers-retours
/// amples en moins de 0,8 s) et appelle `on_shake(x, y)`.
pub fn watch_shake(on_shake: impl Fn(i32, i32) + Send + 'static) {
    std::thread::spawn(move || {
        let mut last = POINT { x: 0, y: 0 };
        unsafe { GetCursorPos(&mut last) };
        let mut dir = 0i32;
        let mut run = 0i32;
        let mut turns: VecDeque<Instant> = VecDeque::new();
        let mut cooldown = Instant::now();
        loop {
            std::thread::sleep(Duration::from_millis(16));
            let mut p = POINT { x: 0, y: 0 };
            if unsafe { GetCursorPos(&mut p) } == 0 {
                continue;
            }
            if !MAGIC_POINTER.load(Ordering::Relaxed) {
                last = p;
                continue;
            }
            let dx = p.x - last.x;
            last = p;
            let now = Instant::now();
            if dx.abs() >= 3 {
                let d = dx.signum();
                if d != dir {
                    if run >= 60 {
                        turns.push_back(now);
                    }
                    dir = d;
                    run = 0;
                }
                run += dx.abs();
            }
            while turns.front().is_some_and(|t| now.duration_since(*t) > Duration::from_millis(800)) {
                turns.pop_front();
            }
            if turns.len() >= 4 && now >= cooldown {
                turns.clear();
                cooldown = now + Duration::from_millis(1500);
                on_shake(p.x, p.y);
            }
        }
    });
}
