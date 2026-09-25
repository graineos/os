//! Wi-Fi et Bluetooth : bascules des radios (WinRT) et réseaux Wi-Fi (WlanAPI).

use serde::Serialize;
use windows::core::{GUID, PCWSTR};
use windows::Devices::Radios::{Radio, RadioAccessStatus, RadioKind, RadioState};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::NetworkManagement::WiFi::{
    wlan_connection_mode_profile, WlanCloseHandle, WlanConnect, WlanEnumInterfaces, WlanFreeMemory,
    WlanGetAvailableNetworkList, WlanOpenHandle, WLAN_AVAILABLE_NETWORK, WLAN_AVAILABLE_NETWORK_CONNECTED,
    WLAN_AVAILABLE_NETWORK_HAS_PROFILE, WLAN_AVAILABLE_NETWORK_LIST, WLAN_CONNECTION_PARAMETERS,
    WLAN_INTERFACE_INFO_LIST,
};

#[derive(Debug, Serialize)]
pub struct Radios {
    pub wifi: Option<bool>,
    pub bluetooth: Option<bool>,
}

fn kind_of(name: &str) -> Option<RadioKind> {
    match name {
        "wifi" => Some(RadioKind::WiFi),
        "bluetooth" => Some(RadioKind::Bluetooth),
        _ => None,
    }
}

/// Les appels WinRT bloquants se font hors du thread de l'interface.
fn off_thread<T: Send + 'static>(f: impl FnOnce() -> windows::core::Result<T> + Send + 'static) -> Result<T, String> {
    std::thread::spawn(f)
        .join()
        .map_err(|_| "Erreur radio.".to_string())?
        .map_err(|e| e.message().to_string())
}

pub fn state() -> Result<Radios, String> {
    off_thread(|| {
        let radios = Radio::GetRadiosAsync()?.get()?;
        let mut out = Radios { wifi: None, bluetooth: None };
        for r in radios {
            let on = r.State()? == RadioState::On;
            match r.Kind()? {
                RadioKind::WiFi => out.wifi = Some(out.wifi.unwrap_or(false) || on),
                RadioKind::Bluetooth => out.bluetooth = Some(out.bluetooth.unwrap_or(false) || on),
                _ => {}
            }
        }
        Ok(out)
    })
}

pub fn set(kind: &str, on: bool) -> Result<(), String> {
    let kind = kind_of(kind).ok_or("Radio inconnue.")?;
    off_thread(move || {
        if Radio::RequestAccessAsync()?.get()? != RadioAccessStatus::Allowed {
            return Err(windows::core::Error::new(windows::core::HRESULT(-1), "Windows refuse l'accès aux radios."));
        }
        let target = if on { RadioState::On } else { RadioState::Off };
        for r in Radio::GetRadiosAsync()?.get()? {
            if r.Kind()? == kind {
                r.SetStateAsync(target)?.get()?;
            }
        }
        Ok(())
    })
}

#[derive(Debug, Serialize)]
pub struct Network {
    pub ssid: String,
    pub signal: u32,
    pub secured: bool,
    pub connected: bool,
    /// Profil enregistré : connexion possible en un clic.
    pub profile: Option<String>,
}

struct Wlan(HANDLE);
impl Drop for Wlan {
    fn drop(&mut self) {
        unsafe {
            WlanCloseHandle(self.0, None);
        }
    }
}

fn open() -> Result<Wlan, String> {
    let mut version = 0u32;
    let mut handle = HANDLE::default();
    let r = unsafe { WlanOpenHandle(2, None, &mut version, &mut handle) };
    if r != 0 {
        return Err("Pas de carte Wi-Fi disponible.".into());
    }
    Ok(Wlan(handle))
}

fn first_interface(w: &Wlan) -> Result<GUID, String> {
    unsafe {
        let mut list: *mut WLAN_INTERFACE_INFO_LIST = std::ptr::null_mut();
        if WlanEnumInterfaces(w.0, None, &mut list) != 0 || list.is_null() {
            return Err("Pas de carte Wi-Fi disponible.".into());
        }
        let count = (*list).dwNumberOfItems;
        let guid = if count > 0 { Some((*list).InterfaceInfo[0].InterfaceGuid) } else { None };
        WlanFreeMemory(list as *const _);
        guid.ok_or_else(|| "Pas de carte Wi-Fi disponible.".into())
    }
}

fn wide_str(buf: &[u16]) -> String {
    let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..end])
}

pub fn networks() -> Result<Vec<Network>, String> {
    let w = open()?;
    let iface = first_interface(&w)?;
    let mut out: Vec<Network> = Vec::new();
    unsafe {
        let mut list: *mut WLAN_AVAILABLE_NETWORK_LIST = std::ptr::null_mut();
        if WlanGetAvailableNetworkList(w.0, &iface, 0, None, &mut list) != 0 || list.is_null() {
            return Err("Recherche des réseaux impossible.".into());
        }
        let count = (*list).dwNumberOfItems as usize;
        let first = (*list).Network.as_ptr();
        let items: &[WLAN_AVAILABLE_NETWORK] = std::slice::from_raw_parts(first, count);
        for n in items {
            let len = (n.dot11Ssid.uSSIDLength as usize).min(32);
            let ssid = String::from_utf8_lossy(&n.dot11Ssid.ucSSID[..len]).to_string();
            if ssid.is_empty() {
                continue;
            }
            let profile = (n.dwFlags & WLAN_AVAILABLE_NETWORK_HAS_PROFILE != 0).then(|| wide_str(&n.strProfileName));
            let entry = Network {
                ssid: ssid.clone(),
                signal: n.wlanSignalQuality,
                secured: n.bSecurityEnabled.as_bool(),
                connected: n.dwFlags & WLAN_AVAILABLE_NETWORK_CONNECTED != 0,
                profile,
            };
            match out.iter_mut().find(|x| x.ssid == ssid) {
                Some(existing) => {
                    existing.signal = existing.signal.max(entry.signal);
                    existing.connected |= entry.connected;
                    if existing.profile.is_none() {
                        existing.profile = entry.profile;
                    }
                }
                None => out.push(entry),
            }
        }
        WlanFreeMemory(list as *const _);
    }
    out.sort_by(|a, b| b.connected.cmp(&a.connected).then(b.signal.cmp(&a.signal)));
    Ok(out)
}

/// Connexion à un réseau déjà enregistré dans Windows (profil existant).
pub fn connect(profile: &str) -> Result<(), String> {
    let w = open()?;
    let iface = first_interface(&w)?;
    let name = super::wide(profile);
    let params = WLAN_CONNECTION_PARAMETERS {
        wlanConnectionMode: wlan_connection_mode_profile,
        strProfile: PCWSTR(name.as_ptr()),
        pDot11Ssid: std::ptr::null_mut(),
        pDesiredBssidList: std::ptr::null_mut(),
        dot11BssType: windows::Win32::NetworkManagement::WiFi::dot11_BSS_type_any,
        dwFlags: 0,
    };
    let r = unsafe { WlanConnect(w.0, &iface, &params, None) };
    if r == 0 {
        Ok(())
    } else {
        Err("Connexion impossible.".into())
    }
}
