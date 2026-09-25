//! Fenêtres façon Android/ChromeOS : miniatures en direct (DWM) pour la Vue
//! d'ensemble et les aperçus du dock, et ancrage gauche/droite/agrandi.

use std::collections::HashMap;
use std::sync::Mutex;

use serde::Deserialize;
use windows_sys::Win32::Foundation::{HWND, RECT};
use windows_sys::Win32::Graphics::Dwm::{
    DwmGetWindowAttribute, DwmQueryThumbnailSourceSize, DwmRegisterThumbnail, DwmUnregisterThumbnail,
    DwmUpdateThumbnailProperties, DWMWA_EXTENDED_FRAME_BOUNDS, DWM_THUMBNAIL_PROPERTIES, DWM_TNP_OPACITY,
    DWM_TNP_RECTDESTINATION, DWM_TNP_SOURCECLIENTAREAONLY, DWM_TNP_VISIBLE,
};
use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetWindowRect, IsIconic, IsWindow, IsZoomed, SetForegroundWindow, SetWindowPos, ShowWindow, SWP_NOACTIVATE,
    SWP_NOZORDER, SW_MAXIMIZE, SW_MINIMIZE, SW_RESTORE,
};

#[derive(Debug, Deserialize)]
pub struct Slot {
    pub id: i64,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// id de fenêtre source → HTHUMBNAIL (isize)
static THUMBS: Mutex<Option<HashMap<i64, isize>>> = Mutex::new(None);

fn hwnd(id: i64) -> HWND {
    id as isize as HWND
}

/// Place les miniatures dans la fenêtre `dest` (coordonnées physiques du client),
/// en gardant les proportions de chaque fenêtre, centrées dans leur case.
pub fn set(dest: isize, slots: Vec<Slot>) {
    let mut guard = THUMBS.lock().unwrap_or_else(|e| e.into_inner());
    let map = guard.get_or_insert_with(HashMap::new);
    let wanted: Vec<i64> = slots.iter().map(|s| s.id).collect();
    map.retain(|id, thumb| {
        let keep = wanted.contains(id);
        if !keep {
            unsafe { DwmUnregisterThumbnail(*thumb) };
        }
        keep
    });
    for s in slots {
        unsafe {
            if IsWindow(hwnd(s.id)) == 0 {
                continue;
            }
            let thumb = match map.get(&s.id) {
                Some(t) => *t,
                None => {
                    let mut t: isize = 0;
                    if DwmRegisterThumbnail(dest as HWND, hwnd(s.id), &mut t) < 0 {
                        continue;
                    }
                    map.insert(s.id, t);
                    t
                }
            };
            let mut size = windows_sys::Win32::Foundation::SIZE { cx: 0, cy: 0 };
            DwmQueryThumbnailSourceSize(thumb, &mut size);
            let (sw, sh) = (size.cx.max(1) as f64, size.cy.max(1) as f64);
            let scale = (s.w as f64 / sw).min(s.h as f64 / sh);
            let (w, h) = ((sw * scale) as i32, (sh * scale) as i32);
            let x = s.x + (s.w - w) / 2;
            let y = s.y + (s.h - h) / 2;
            let props = DWM_THUMBNAIL_PROPERTIES {
                dwFlags: DWM_TNP_RECTDESTINATION | DWM_TNP_VISIBLE | DWM_TNP_OPACITY | DWM_TNP_SOURCECLIENTAREAONLY,
                rcDestination: RECT { left: x, top: y, right: x + w, bottom: y + h },
                rcSource: RECT { left: 0, top: 0, right: 0, bottom: 0 },
                opacity: 255,
                fVisible: 1,
                fSourceClientAreaOnly: 0,
            };
            DwmUpdateThumbnailProperties(thumb, &props);
        }
    }
}

pub fn clear() {
    let mut guard = THUMBS.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(map) = guard.as_mut() {
        for (_, t) in map.drain() {
            unsafe { DwmUnregisterThumbnail(t) };
        }
    }
}

/// Ancre une fenêtre : "left", "right", "max", "restore" ou "min".
pub fn snap(id: i64, mode: &str) -> Result<(), String> {
    let h = hwnd(id);
    unsafe {
        if IsWindow(h) == 0 {
            return Err("Cette fenêtre n'existe plus.".into());
        }
        match mode {
            "max" => {
                ShowWindow(h, SW_MAXIMIZE);
            }
            "min" => {
                ShowWindow(h, SW_MINIMIZE);
                return Ok(());
            }
            "restore" => {
                ShowWindow(h, SW_RESTORE);
            }
            "left" | "right" => {
                if IsZoomed(h) != 0 || IsIconic(h) != 0 {
                    ShowWindow(h, SW_RESTORE);
                }
                let mon = MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST);
                let mut info: MONITORINFO = std::mem::zeroed();
                info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
                GetMonitorInfoW(mon, &mut info);
                let work = info.rcWork;
                let half = (work.right - work.left) / 2;
                let x = if mode == "left" { work.left } else { work.left + half };
                // Compense les bordures invisibles de Windows 10/11.
                let mut outer = RECT { left: 0, top: 0, right: 0, bottom: 0 };
                let mut frame = outer;
                GetWindowRect(h, &mut outer);
                DwmGetWindowAttribute(
                    h,
                    DWMWA_EXTENDED_FRAME_BOUNDS as u32,
                    (&mut frame as *mut RECT).cast(),
                    std::mem::size_of::<RECT>() as u32,
                );
                let (dl, dt) = (frame.left - outer.left, frame.top - outer.top);
                let (dr, db) = (outer.right - frame.right, outer.bottom - frame.bottom);
                SetWindowPos(
                    h,
                    std::ptr::null_mut(),
                    x - dl,
                    work.top - dt,
                    half + dl + dr,
                    (work.bottom - work.top) + dt + db,
                    SWP_NOZORDER | SWP_NOACTIVATE,
                );
            }
            _ => return Err("Ancrage inconnu.".into()),
        }
        SetForegroundWindow(h);
    }
    Ok(())
}
