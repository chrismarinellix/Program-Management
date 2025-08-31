use std::fs::OpenOptions;
use std::io::Write;
use chrono::Local;
use std::sync::Mutex;

lazy_static::lazy_static! {
    static ref DEBUG_FILE: Mutex<()> = Mutex::new(());
}

pub fn debug_log(message: &str) {
    let _lock = DEBUG_FILE.lock().unwrap();
    
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let log_message = format!("[{}] {}\n", timestamp, message);
    
    // Print to console
    println!("{}", log_message);
    
    // Write to file
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open("/tmp/tauri-debug.log")
    {
        let _ = file.write_all(log_message.as_bytes());
    }
}

#[tauri::command]
pub fn write_debug_log(message: String) {
    debug_log(&format!("Frontend: {}", message));
}