//! Accès minimal au registre de l'utilisateur (HKEY_CURRENT_USER).

use std::ptr::{null, null_mut};

use serde::{Deserialize, Serialize};
use windows_sys::Win32::Foundation::ERROR_SUCCESS;
use windows_sys::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    HKEY, HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_DWORD, REG_OPTION_NON_VOLATILE, REG_SZ,
};

use super::wide;

/// Valeur brute : type de registre + octets. Permet de tout restaurer à l'identique.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Raw {
    pub kind: u32,
    pub data: Vec<u8>,
}

pub fn get(path: &str, name: &str) -> Option<Raw> {
    unsafe {
        let mut key: HKEY = null_mut();
        if RegOpenKeyExW(HKEY_CURRENT_USER, wide(path).as_ptr(), 0, KEY_READ, &mut key) != ERROR_SUCCESS {
            return None;
        }
        let n = wide(name);
        let mut kind = 0u32;
        let mut len = 0u32;
        let mut out = None;
        if RegQueryValueExW(key, n.as_ptr(), null(), &mut kind, null_mut(), &mut len) == ERROR_SUCCESS {
            let mut data = vec![0u8; len as usize];
            if RegQueryValueExW(key, n.as_ptr(), null(), &mut kind, data.as_mut_ptr(), &mut len) == ERROR_SUCCESS {
                data.truncate(len as usize);
                out = Some(Raw { kind, data });
            }
        }
        RegCloseKey(key);
        out
    }
}

pub fn set(path: &str, name: &str, kind: u32, data: &[u8]) -> bool {
    unsafe {
        let mut key: HKEY = null_mut();
        if RegCreateKeyExW(
            HKEY_CURRENT_USER,
            wide(path).as_ptr(),
            0,
            null(),
            REG_OPTION_NON_VOLATILE,
            KEY_WRITE,
            null(),
            &mut key,
            null_mut(),
        ) != ERROR_SUCCESS
        {
            return false;
        }
        let ok = RegSetValueExW(key, wide(name).as_ptr(), 0, kind, data.as_ptr(), data.len() as u32) == ERROR_SUCCESS;
        RegCloseKey(key);
        ok
    }
}

pub fn delete(path: &str, name: &str) {
    unsafe {
        let mut key: HKEY = null_mut();
        if RegOpenKeyExW(HKEY_CURRENT_USER, wide(path).as_ptr(), 0, KEY_WRITE, &mut key) == ERROR_SUCCESS {
            RegDeleteValueW(key, wide(name).as_ptr());
            RegCloseKey(key);
        }
    }
}

pub fn set_dword(path: &str, name: &str, v: u32) -> bool {
    set(path, name, REG_DWORD, &v.to_le_bytes())
}

pub fn set_sz(path: &str, name: &str, s: &str) -> bool {
    let bytes: Vec<u8> = wide(s).iter().flat_map(|c| c.to_le_bytes()).collect();
    set(path, name, REG_SZ, &bytes)
}
