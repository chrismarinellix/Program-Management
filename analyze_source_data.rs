use calamine::{open_workbook, Reader, Xlsx, Data};
use std::path::Path;

fn main() {
    let file_path = "/Users/chris/Downloads/Project Task Performance_Restored.xlsm";
    let path = Path::new(file_path);
    
    match open_workbook::<Xlsx<_>, _>(path) {
        Ok(mut workbook) => {
            // Analyze IFS activitie estimates (source for budgets)
            if let Ok(range) = workbook.worksheet_range("IFS activitie estimates") {
                println!("=== IFS activitie estimates (AE) - Budget Source ===");
                println!("Dimensions: {} rows x {} columns\n", range.height(), range.width());
                
                // Get headers
                if let Some(header_row) = range.rows().nth(0) {
                    println!("Key columns:");
                    for (idx, cell) in header_row.iter().enumerate() {
                        if let Data::String(s) = cell {
                            if s.contains("Activity") || s.contains("Cost") || s.contains("Revenue") || s.contains("Hours") || s.contains("Seq") {
                                println!("  Column {}: {}", (b'A' + idx as u8) as char, s);
                            }
                        }
                    }
                }
                
                println!("\nSample data rows:");
                for (row_idx, row) in range.rows().enumerate().skip(1).take(3) {
                    let sample: Vec<String> = row.iter().take(23).map(|cell| {
                        match cell {
                            Data::String(s) => s.chars().take(15).collect(),
                            Data::Float(f) => format!("{:.0}", f),
                            _ => "-".to_string(),
                        }
                    }).collect();
                    println!("Row {}: {:?}", row_idx + 1, sample);
                }
            }
            
            // Analyze IFS project (P)
            if let Ok(range) = workbook.worksheet_range("IFS project") {
                println!("\n=== IFS project (P) - Project Master Data ===");
                println!("Dimensions: {} rows x {} columns\n", range.height(), range.width());
                
                // Get headers
                if let Some(header_row) = range.rows().nth(0) {
                    println!("Key columns:");
                    for (idx, cell) in header_row.iter().enumerate().take(10) {
                        if let Data::String(s) = cell {
                            println!("  Column {}: {}", (b'A' + idx as u8) as char, s);
                        }
                    }
                }
                
                println!("\nSample data:");
                for (row_idx, row) in range.rows().enumerate().skip(1).take(3) {
                    let sample: Vec<String> = row.iter().take(10).map(|cell| {
                        match cell {
                            Data::String(s) => s.chars().take(15).collect(),
                            Data::Float(f) => format!("{:.0}", f),
                            _ => "-".to_string(),
                        }
                    }).collect();
                    println!("Row {}: {:?}", row_idx + 1, sample);
                }
            }
            
            // Analyze IFS project transactions (PT)
            if let Ok(range) = workbook.worksheet_range("IFS project transactions") {
                println!("\n=== IFS project transactions (PT) - Actual Costs ===");
                println!("Dimensions: {} rows x {} columns\n", range.height(), range.width());
                
                // Get headers
                if let Some(header_row) = range.rows().nth(0) {
                    println!("Key columns:");
                    for (idx, cell) in header_row.iter().enumerate() {
                        if let Data::String(s) = cell {
                            if s.contains("Activity") || s.contains("Amount") || s.contains("Cost") || s.contains("Hours") || s.contains("Quantity") || s.contains("Internal") || s.contains("Sales") {
                                println!("  Column {}: {}", (b'A' + idx as u8) as char, s);
                            }
                        }
                    }
                }
                
                println!("\nSample data rows:");
                for (row_idx, row) in range.rows().enumerate().skip(1).take(3) {
                    let sample: Vec<String> = row.iter().skip(5).take(10).map(|cell| {
                        match cell {
                            Data::String(s) => s.chars().take(15).collect(),
                            Data::Float(f) => format!("{:.2}", f),
                            _ => "-".to_string(),
                        }
                    }).collect();
                    println!("Row {} (cols F-O): {:?}", row_idx + 1, sample);
                }
            }
        }
        Err(e) => println!("Error: {}", e)
    }
}
