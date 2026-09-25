// Pas de console noire derrière OpenBook en release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    openbook_lib::run()
}
