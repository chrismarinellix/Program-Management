use calamine::{open_workbook, Reader, Xlsx, Data};
use std::path::Path;

fn main() {
    let file_path = "/Users/chris/Downloads/Project Task Performance_Restored.xlsm";
    let path = Path::new(file_path);
    
    match open_workbook::<Xlsx<_>, _>(path) {
        Ok(mut workbook) => {
            // Get AE headers
            if let Ok(range) = workbook.worksheet_range("IFS activitie estimates") {
                println!("=== AE Sheet Headers (All columns) ===");
                if let Some(header_row) = range.rows().nth(0) {
                    for (idx, cell) in header_row.iter().enumerate() {
                        if let Data::String(s) = cell {
                            println!("Column {} ({}): {}", idx, (b'A' + (idx % 26) as u8) as char, s);
                        }
                    }
                }
            }
            
            // Get PT headers
            if let Ok(range) = workbook.worksheet_range("IFS project transactions") {
                println!("\n=== PT Sheet Headers (Key columns) ===");
                if let Some(header_row) = range.rows().nth(0) {
                    for (idx, cell) in header_row.iter().enumerate() {
                        if let Data::String(s) = cell {
                            // Print columns that seem relevant for calculations
                            if s.contains("Activity") || s.contains("Amount") || 
                               s.contains("Hours") || s.contains("Quantity") || 
                               s.contains("Internal") || s.contains("Sales") ||
                               s.contains("Cost") || idx < 10 {
                                let col_letter = if idx < 26 {
                                    format!("{}", (b'A' + idx as u8) as char)
                                } else {
                                    format!("A{}", (b'A' + (idx - 26) as u8) as char)
                                };
                                println!("Column {} ({}): {}", idx, col_letter, s);
                            }
                        }
                    }
                }
            }
        }
        Err(e) => println!("Error: {}", e)
    }
}
