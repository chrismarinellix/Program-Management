use calamine::{open_workbook, Reader, Xlsx, Data};
use std::path::Path;

fn main() {
    let file_path = "/Users/chris/Downloads/Project Task Performance_Restored.xlsm";
    let path = Path::new(file_path);
    
    match open_workbook::<Xlsx<_>, _>(path) {
        Ok(mut workbook) => {
            // Analyze Workingsheet column headers and formulas
            if let Ok(range) = workbook.worksheet_range("Workingsheet") {
                println!("=== Workingsheet Column Analysis ===");
                
                // Print headers from rows 4-5 (columns 8-20 for budget/actual area)
                println!("\nColumn Headers (rows 4-5, columns I-T):");
                for row_idx in 3..5 {
                    let row_data: Vec<String> = range.rows().nth(row_idx).unwrap_or(&vec![])
                        .iter().skip(8).take(12)
                        .map(|cell| match cell {
                            Data::String(s) => s.clone(),
                            Data::Float(f) => format!("{:.2}", f),
                            Data::Empty => "".to_string(),
                            _ => "?".to_string(),
                        }).collect();
                    println!("Row {}: {:?}", row_idx + 1, row_data);
                }
                
                // Show sample data rows with budget/actual/remaining values
                println!("\nSample data rows (columns F-T):");
                println!("Activity Seq | Budget Hours | Budget Cost | Budget Rev | Actual Count | Actual Cost | Actual Rev | Remaining cols...");
                
                for row_idx in 5..15 {
                    if let Some(row) = range.rows().nth(row_idx) {
                        let activity = match &row[5] {
                            Data::Float(f) => format!("{:.0}", f),
                            Data::String(s) => s.clone(),
                            _ => "".to_string(),
                        };
                        
                        let values: Vec<String> = row.iter().skip(8).take(10)
                            .map(|cell| match cell {
                                Data::Float(f) => format!("{:.2}", f),
                                Data::String(s) => s.clone(),
                                Data::Empty => "-".to_string(),
                                _ => "?".to_string(),
                            }).collect();
                        
                        println!("{} | {}", activity, values.join(" | "));
                    }
                }
            }
        }
        Err(e) => {
            println!("Error: {}", e);
        }
    }
}
