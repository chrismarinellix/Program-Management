use calamine::{open_workbook, Reader, Xlsx, Data};
use std::path::Path;

fn main() {
    let file_path = "/Users/chris/Downloads/Project Task Performance_Restored.xlsm";
    let path = Path::new(file_path);
    
    match open_workbook::<Xlsx<_>, _>(path) {
        Ok(mut workbook) => {
            // Get AE headers (row 1)
            if let Ok(range) = workbook.worksheet_range("IFS activitie estimates") {
                println!("=== AE Sheet Headers ===");
                if let Some(header_row) = range.rows().nth(1) {
                    for (idx, cell) in header_row.iter().enumerate() {
                        match cell {
                            Data::String(s) if !s.is_empty() => {
                                println!("Col {}: {}", (b'A' + idx as u8) as char, s);
                            }
                            _ => {}
                        }
                    }
                }
            }
            
            // Get PT headers (row 1)
            if let Ok(range) = workbook.worksheet_range("IFS project transactions") {
                println!("\n=== PT Sheet Key Headers ===");
                if let Some(header_row) = range.rows().nth(1) {
                    for (idx, cell) in header_row.iter().enumerate() {
                        match cell {
                            Data::String(s) if !s.is_empty() => {
                                // Focus on important columns
                                if s.contains("Activity") || s.contains("Amount") || 
                                   s.contains("Hours") || s.contains("Quantity") || 
                                   s.contains("Internal") || s.contains("Sales") {
                                    let col_letter = if idx < 26 {
                                        format!("{}", (b'A' + idx as u8) as char)
                                    } else if idx < 52 {
                                        format!("A{}", (b'A' + (idx - 26) as u8) as char)
                                    } else {
                                        format!("B{}", (b'A' + (idx - 52) as u8) as char)
                                    };
                                    println!("Col {}: {}", col_letter, s);
                                }
                            }
                            _ => {}
                        }
                    }
                }
                
                // Also check actual data to understand the values
                println!("\n=== Sample PT Data (Activity Seq and Amounts) ===");
                for row_idx in 2..7 {
                    if let Some(row) = range.rows().nth(row_idx) {
                        let activity_seq = match &row[5] {
                            Data::Float(f) => format!("{:.0}", f),
                            Data::String(s) => s.clone(),
                            _ => "-".to_string(),
                        };
                        
                        let internal_qty = match &row[33] {
                            Data::Float(f) => format!("{:.2}", f),
                            _ => "-".to_string(),
                        };
                        
                        let internal_amt = match &row[34] {
                            Data::Float(f) => format!("{:.2}", f),
                            _ => "-".to_string(),
                        };
                        
                        let sales_amt = match &row[35] {
                            Data::Float(f) => format!("{:.2}", f),
                            _ => "-".to_string(),
                        };
                        
                        println!("Row {}: Activity={}, IntQty={}, IntAmt={}, SalesAmt={}", 
                                 row_idx + 1, activity_seq, internal_qty, internal_amt, sales_amt);
                    }
                }
            }
        }
        Err(e) => println!("Error: {}", e)
    }
}
