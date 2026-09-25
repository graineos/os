//! Entrées globales :
//! - Quick Insert : la touche Verr. Maj ouvre la recherche d'OpenBook
//!   (Maj + Verr. Maj garde le comportement normal). Seule cette touche
//!   est examinée ; aucune autre frappe n'est lue ni enregistrée.
//! - Magic Pointer : secouer la souris n'importe où ouvre la bulle Gemini.

use std::collections::VecDeque;
use std::ptr::null_mut;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use windows_sys::Win32::Foundation::{LPARAM, LRESULT, POINT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_CAPITAL, VK_SHIFT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetCursorPos, GetMessageW, SetWindowsHookExW, TranslateMessage, HC_ACTION,
    KBDLLHOOKSTRUCT, LLKHF_INJECTED, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
};

pub static QUICK_INSERT: AtomicBool = AtomicBool::new(true);
pub static MAGIC_POINTER: AtomicBool = AtomicBool::new(true);

static CAPS_SENDER: OnceLock<Sender<()>> = OnceLock::new();
static CAPS_DOWN: AtomicBool = AtomicBool::new(false);

unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 && QUICK_INSERT.load(Ordering::Relaxed) {
        let k = &*(lparam as *const KBDLLHOOKSTRUCT);
        let shift = GetAsyncKeyState(VK_SHIFT as i32) < 0;
        if k.vkCode == VK_CAPITAL as u32 && k.flags & LLKHF_INJECTED == 0 && !shift {
            match wparam as u32 {
                WM_KEYDOWN | WM_SYSKEYDOWN => {
                    // Un seul événement par appui, même si la touche reste enfoncée.
                    if !CAPS_DOWN.swap(true, Ordering::Relaxed) {
                        if let Some(tx) = CAPS_SENDER.get() {
                            let _ = tx.send(());
                        }
                    }
                }
                WM_KEYUP | WM_SYSKEYUP => CAPS_DOWN.store(false, Ordering::Relaxed),
                _ => {}
            }
            return 1; // Verr. Maj n'est pas basculé
        }
    }
    CallNextHookEx(null_mut(), code, wparam, lparam)
}

/// Appelle `on_press` à chaque appui sur Verr. Maj.
pub fn watch_caps_lock(on_press: impl Fn() + Send + 'static) {
    let (tx, rx) = std::sync::mpsc::channel();
    if CAPS_SENDER.set(tx).is_err() {
        return;
    }
    std::thread::spawn(move || {
        for () in rx {
            on_press();
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
