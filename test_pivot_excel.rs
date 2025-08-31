use calamine::{open_workbook, Reader, Xlsx, Data};
use std::path::Path;

fn main() {
    let file_path = "/Users/chris/Downloads/Project Task Performance_Restored.xlsm";
    let path = Path::new(file_path);
    
    match open_workbook::<Xlsx<_>, _>(path) {
        Ok(mut workbook) => {
            // Analyze PT - Budgets sheet
            if let Ok(range) = workbook.worksheet_range("PT - Budgets") {
                println!("=== PT - Budgets Sheet ===");
                println!("Dimensions: {} rows x {} columns", range.height(), range.width());
                
                println!("\nFirst 10 rows:");
                for (row_idx, row) in range.rows().enumerate() {
                    if row_idx >= 10 { break; }
                    
                    let row_str: Vec<String> = row.iter().take(8).map(|cell| {
                        match cell {
                            Data::String(s) => s.clone(),
                            Data::Float(f) => format!("{:.2}", f),
                            Data::Int(i) => i.to_string(),
                            Data::Bool(b) => b.to_string(),
                            Data::Empty => "".to_string(),
                            _ => "?".to_string(),
                        }
                    }).collect();
                    
                    println!("Row {}: {:?}", row_idx + 1, row_str);
                }
            }
            
            // Analyze PT - Actuals sheet
            if let Ok(range) = workbook.worksheet_range("PT - Actuals") {
                println!("\n=== PT - Actuals Sheet ===");
                println!("Dimensions: {} rows x {} columns", range.height(), range.width());
                
                println!("\nFirst 10 rows:");
                for (row_idx, row) in range.rows().enumerate() {
                    if row_idx >= 10 { break; }
                    
                    let row_str: Vec<String> = row.iter().take(8).map(|cell| {
                        match cell {
                            Data::String(s) => s.clone(),
                            Data::Float(f) => format!("{:.2}", f),
                            Data::Int(i) => i.to_string(),
                            Data::Bool(b) => b.to_string(),
                            Data::Empty => "".to_string(),
                            _ => "?".to_string(),
                        }
                    }).collect();
                    
                    println!("Row {}: {:?}", row_idx + 1, row_str);
                }
            }
            
            // Analyze Workingsheet
            if let Ok(range) = workbook.worksheet_range("Workingsheet") {
                println!("\n=== Workingsheet ===");
                println!("Dimensions: {} rows x {} columns", range.height(), range.width());
                
                println!("\nFirst 15 rows (looking for formulas):");
                for (row_idx, row) in range.rows().enumerate() {
                    if row_idx >= 15 { break; }
                    
                    let row_str: Vec<String> = row.iter().take(10).map(|cell| {
                        match cell {
                            Data::String(s) => s.clone(),
                            Data::Float(f) => format!("{:.2}", f),
                            Data::Int(i) => i.to_string(),
                            Data::Bool(b) => b.to_string(),
                            Data::Empty => "".to_string(),
                            _ => "?".to_string(),
                        }
                    }).collect();
                    
                    println!("Row {}: {:?}", row_idx + 1, row_str);
                }
            }
        }
        Err(e) => {
            println!("Error opening workbook: {}", e);
        }
    }
}
