//! Lecteur multimédia : la musique ou la vidéo en cours dans Windows (SMTC),
//! comme le lecteur des réglages rapides d'Android.

use base64::Engine;
use serde::Serialize;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
};
use windows::Storage::Streams::DataReader;

#[derive(Debug, Serialize)]
pub struct NowPlaying {
    pub title: String,
    pub artist: String,
    pub app: String,
    pub playing: bool,
    pub cover: Option<String>,
}

fn off_thread<T: Send + 'static>(f: impl FnOnce() -> windows::core::Result<T> + Send + 'static) -> Result<T, String> {
    std::thread::spawn(f)
        .join()
        .map_err(|_| "Erreur multimédia.".to_string())?
        .map_err(|e| e.message().to_string())
}

pub fn now_playing() -> Result<Option<NowPlaying>, String> {
    off_thread(|| {
        let manager = Manager::RequestAsync()?.get()?;
        let Ok(session) = manager.GetCurrentSession() else { return Ok(None) };
        let props = session.TryGetMediaPropertiesAsync()?.get()?;
        let playing = session.GetPlaybackInfo()?.PlaybackStatus()? == Status::Playing;
        let cover = (|| -> windows::core::Result<Option<String>> {
            let Ok(thumb) = props.Thumbnail() else { return Ok(None) };
            let stream = thumb.OpenReadAsync()?.get()?;
            let size = stream.Size()? as u32;
            if size == 0 || size > 2_000_000 {
                return Ok(None);
            }
            let reader = DataReader::CreateDataReader(&stream)?;
            reader.LoadAsync(size)?.get()?;
            let mut bytes = vec![0u8; size as usize];
            reader.ReadBytes(&mut bytes)?;
            let mime = stream.ContentType().map(|s| s.to_string()).unwrap_or_default();
            let mime = if mime.is_empty() { "image/png".to_string() } else { mime };
            Ok(Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes))))
        })()
        .unwrap_or(None);
        Ok(Some(NowPlaying {
            title: props.Title()?.to_string(),
            artist: props.Artist()?.to_string(),
            app: session.SourceAppUserModelId()?.to_string(),
            playing,
            cover,
        }))
    })
}

pub fn control(action: &str) -> Result<(), String> {
    let action = action.to_string();
    off_thread(move || {
        let manager = Manager::RequestAsync()?.get()?;
        let Ok(session) = manager.GetCurrentSession() else { return Ok(()) };
        match action.as_str() {
            "toggle" => session.TryTogglePlayPauseAsync()?.get()?,
            "next" => session.TrySkipNextAsync()?.get()?,
            "previous" => session.TrySkipPreviousAsync()?.get()?,
            _ => false,
        };
        Ok(())
    })
}
