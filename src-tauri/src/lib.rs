mod excel;
mod debug;

use excel::{ExcelData, DataValue, CellUpdate};
use tauri::Manager;
use std::fs;
use std::path::PathBuf;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn read_excel(file_path: String) -> Result<Vec<ExcelData>, String> {
    excel::read_excel_file(&file_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_excel(file_path: String, data: Vec<ExcelData>) -> Result<(), String> {
    excel::write_excel_file(&file_path, data)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_cell(
    file_path: String,
    sheet_name: String,
    row: usize,
    col: usize,
    value: DataValue
) -> Result<(), String> {
    excel::update_excel_cell(&file_path, &sheet_name, row, col, value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_excel_cells(
    file_path: String,
    sheet_name: String,
    updates: Vec<CellUpdate>
) -> Result<(), String> {
    excel::update_excel_cells(&file_path, &sheet_name, updates)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_project_notes(project_id: String, notes: String) -> Result<(), String> {
    // Create a notes directory if it doesn't exist
    let notes_dir = PathBuf::from("project_notes");
    fs::create_dir_all(&notes_dir).map_err(|e| e.to_string())?;
    
    // Create a safe filename from the project ID
    let safe_filename = project_id.replace("/", "_").replace("\\", "_");
    let file_path = notes_dir.join(format!("{}.txt", safe_filename));
    
    // Save the notes
    fs::write(&file_path, notes).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn load_project_notes(project_id: String) -> Result<String, String> {
    // Create a safe filename from the project ID
    let safe_filename = project_id.replace("/", "_").replace("\\", "_");
    let file_path = PathBuf::from("project_notes").join(format!("{}.txt", safe_filename));
    
    // Load the notes if the file exists
    if file_path.exists() {
        fs::read_to_string(&file_path).map_err(|e| e.to_string())
    } else {
        Ok(String::new())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            read_excel,
            write_excel,
            update_cell,
            update_excel_cells,
            save_project_notes,
            load_project_notes
        ])
        .setup(|app| {
            // Start maximized (fullscreen can be problematic on some systems)
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.maximize();
                // Alternatively, try fullscreen after a delay
                let window_clone = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let _ = window_clone.set_fullscreen(true);
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
