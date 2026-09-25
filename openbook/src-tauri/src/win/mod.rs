//! Tout ce qui parle directement à Windows (API Win32, sans outil tiers).

pub mod apps;
pub mod audio;
pub mod files;
pub mod input;
pub mod media;
pub mod quick;
pub mod radios;
pub mod reg;
pub mod settings;
pub mod system;
pub mod thumbs;
pub mod windows;

/// Chaîne UTF-16 terminée par un zéro, pour les API « W ».
pub fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Lit une chaîne UTF-16 jusqu'au premier zéro.
pub fn from_wide(buf: &[u16]) -> String {
    let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..end])
}
