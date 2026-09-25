//! Volume réel du périphérique de sortie par défaut (Core Audio).

use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED};

#[derive(serde::Serialize)]
pub struct Volume {
    /// 0..=100
    pub level: u8,
    pub muted: bool,
}

/// Exécute `f` sur un thread COM dédié.
fn with_endpoint<T: Send + 'static>(
    f: impl FnOnce(&IAudioEndpointVolume) -> windows::core::Result<T> + Send + 'static,
) -> Result<T, String> {
    std::thread::spawn(move || unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let result = (|| {
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
            let endpoint: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)?;
            f(&endpoint)
        })();
        CoUninitialize();
        result.map_err(|e| e.message().to_string())
    })
    .join()
    .map_err(|_| "Erreur audio.".to_string())?
}

pub fn get() -> Result<Volume, String> {
    with_endpoint(|ep| unsafe {
        Ok(Volume {
            level: (ep.GetMasterVolumeLevelScalar()? * 100.0).round() as u8,
            muted: ep.GetMute()?.as_bool(),
        })
    })
}

pub fn set_level(level: u8) -> Result<(), String> {
    let v = level.min(100) as f32 / 100.0;
    with_endpoint(move |ep| unsafe {
        ep.SetMasterVolumeLevelScalar(v, std::ptr::null())?;
        if v > 0.0 {
            ep.SetMute(false, std::ptr::null())?;
        }
        Ok(())
    })
}

pub fn set_muted(muted: bool) -> Result<(), String> {
    with_endpoint(move |ep| unsafe { ep.SetMute(muted, std::ptr::null()) })
}
