//! Presse-papiers et luminosité.

use std::os::windows::process::CommandExt;
use std::process::Command;
use std::ptr::null_mut;

use windows_sys::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData};
use windows_sys::Win32::Foundation::GlobalFree;
use windows_sys::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

use super::wide;

const CF_UNICODETEXT: u32 = 13;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn copy_text(text: &str) -> Result<(), String> {
    let w = wide(text);
    unsafe {
        let mut opened = false;
        for _ in 0..10 {
            if OpenClipboard(null_mut()) != 0 {
                opened = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        if !opened {
            return Err("Presse-papiers occupé.".into());
        }
        EmptyClipboard();
        let bytes = w.len() * 2;
        let mem = GlobalAlloc(GMEM_MOVEABLE, bytes);
        if mem.is_null() {
            CloseClipboard();
            return Err("Mémoire insuffisante.".into());
        }
        let dst = GlobalLock(mem) as *mut u16;
        std::ptr::copy_nonoverlapping(w.as_ptr(), dst, w.len());
        GlobalUnlock(mem);
        let ok = !SetClipboardData(CF_UNICODETEXT, mem).is_null();
        if !ok {
            GlobalFree(mem);
        }
        CloseClipboard();
        if ok {
            Ok(())
        } else {
            Err("Copie impossible.".into())
        }
    }
}

fn powershell(script: &str) -> Option<String> {
    let out = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    out.status.success().then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Luminosité de l'écran intégré (portables). None sur un écran externe.
pub fn brightness() -> Option<u8> {
    powershell("(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1).CurrentBrightness")?
        .parse()
        .ok()
}

pub fn set_brightness(level: u8) -> Result<(), String> {
    let level = level.min(100);
    powershell(&format!(
        "Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{{Timeout=1;Brightness={level}}} | Out-Null"
    ))
    .map(|_| ())
    .ok_or_else(|| "Luminosité non réglable sur cet écran.".into())
}
