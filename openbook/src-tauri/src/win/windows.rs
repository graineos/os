//! Fenêtres ouvertes des autres applis : liste, mise au premier plan, fermeture.

use serde::Serialize;
use windows_sys::Win32::Foundation::{CloseHandle, HWND, LPARAM};
use windows_sys::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
use windows_sys::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetClassNameW, GetForegroundWindow, GetWindow, GetWindowLongPtrW, GetWindowTextLengthW,
    GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible, PostMessageW, SetForegroundWindow,
    ShowWindow, GWL_EXSTYLE, GW_OWNER, SW_RESTORE, WM_CLOSE, WS_EX_TOOLWINDOW,
};

use super::from_wide;

#[derive(Debug, Serialize)]
pub struct OpenWindow {
    pub id: i64,
    pub title: String,
    pub exe: String,
    pub active: bool,
    pub minimized: bool,
}

unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> windows_sys::core::BOOL {
    let list = &mut *(lparam as *mut Vec<isize>);
    list.push(hwnd as isize);
    1
}

fn process_path(pid: u32) -> String {
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            return String::new();
        }
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut len) != 0;
        CloseHandle(h);
        if ok {
            String::from_utf16_lossy(&buf[..len as usize])
        } else {
            String::new()
        }
    }
}

const HIDDEN_CLASSES: [&str; 5] = ["Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "Windows.UI.Core.CoreWindow"];

pub fn list() -> Vec<OpenWindow> {
    let mut handles: Vec<isize> = Vec::new();
    let own = std::process::id();
    let mut out = Vec::new();
    unsafe {
        EnumWindows(Some(collect), &mut handles as *mut Vec<isize> as LPARAM);
        let fg = GetForegroundWindow() as isize;
        for h in handles {
            let hwnd = h as HWND;
            if IsWindowVisible(hwnd) == 0 || !GetWindow(hwnd, GW_OWNER).is_null() {
                continue;
            }
            let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            if ex & WS_EX_TOOLWINDOW != 0 {
                continue;
            }
            let mut cloaked = 0u32;
            if DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED as u32, (&mut cloaked as *mut u32).cast(), 4) == 0 && cloaked != 0 {
                continue;
            }
            let len = GetWindowTextLengthW(hwnd);
            if len == 0 {
                continue;
            }
            let mut class = [0u16; 128];
            GetClassNameW(hwnd, class.as_mut_ptr(), class.len() as i32);
            if HIDDEN_CLASSES.contains(&from_wide(&class).as_str()) {
                continue;
            }
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, &mut pid);
            if pid == own {
                continue;
            }
            let mut title = vec![0u16; len as usize + 1];
            GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);
            out.push(OpenWindow {
                id: h as i64,
                title: from_wide(&title),
                exe: process_path(pid),
                active: h == fg,
                minimized: IsIconic(hwnd) != 0,
            });
        }
    }
    out
}

fn handle(id: i64) -> Result<HWND, String> {
    let hwnd = id as isize as HWND;
    if unsafe { IsWindow(hwnd) } == 0 {
        return Err("Cette fenêtre n'existe plus.".into());
    }
    Ok(hwnd)
}

pub fn focus(id: i64) -> Result<(), String> {
    let hwnd = handle(id)?;
    unsafe {
        if IsIconic(hwnd) != 0 {
            ShowWindow(hwnd, SW_RESTORE);
        }
        SetForegroundWindow(hwnd);
    }
    Ok(())
}

pub fn close(id: i64) -> Result<(), String> {
    let hwnd = handle(id)?;
    unsafe {
        PostMessageW(hwnd, WM_CLOSE, 0, 0);
    }
    Ok(())
}
