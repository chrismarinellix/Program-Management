use calamine::{open_workbook, Reader, Xlsx, Data};
use rust_xlsxwriter::Workbook;
use serde::{Deserialize, Serialize};
use std::path::Path;
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StockData {
    pub date: String,
    pub symbol: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: i64,
    pub adjusted_close: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExcelData {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<DataValue>>,
    pub sheet_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum DataValue {
    Text(String),
    Number(f64),
    Integer(i64),
    Boolean(bool),
    Empty,
}

impl From<Data> for DataValue {
    fn from(dt: Data) -> Self {
        match dt {
            Data::String(s) => DataValue::Text(s),
            Data::Float(f) => DataValue::Number(f),
            Data::Int(i) => DataValue::Integer(i),
            Data::Bool(b) => DataValue::Boolean(b),
            Data::Empty => DataValue::Empty,
            Data::Error(_) => DataValue::Empty,
            Data::DateTime(d) => DataValue::Number(d.as_f64()),
            Data::DateTimeIso(s) => DataValue::Text(s),
            Data::DurationIso(s) => DataValue::Text(s),
        }
    }
}

pub fn read_excel_file(file_path: &str) -> Result<Vec<ExcelData>> {
    let path = Path::new(file_path);
    let mut workbook: Xlsx<_> = open_workbook(path)?;
    let mut all_sheets = Vec::new();

    for sheet_name in workbook.sheet_names() {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            let mut headers = Vec::new();
            let mut rows = Vec::new();
            
            // Special handling for different sheets with different header rows
            let header_row_index = if sheet_name.to_lowercase().contains("pipeline") { 
                10  // Pipeline headers in row 11
            } else if sheet_name.to_lowercase().contains("program") && !sheet_name.to_lowercase().contains("vacation") { 
                2   // Program Management headers in row 3
            } else { 
                0   // Default headers in row 1
            };

            for (row_idx, row) in range.rows().enumerate() {
                let row_data: Vec<DataValue> = row.iter()
                    .map(|cell| DataValue::from(cell.clone()))
                    .collect();

                // Always add the row to rows array
                rows.push(row_data.clone());
                
                // Also extract headers for the headers field
                if row_idx == header_row_index && !sheet_name.to_lowercase().contains("vacation") {
                    headers = row_data.iter()
                        .map(|v| match v {
                            DataValue::Text(s) => s.clone(),
                            DataValue::Number(n) => n.to_string(),
                            _ => String::new(),
                        })
                        .collect();
                }
            }
            
            // For vacation sheet, create dummy headers since we're including all data
            if sheet_name.to_lowercase().contains("vacation") && headers.is_empty() {
                if let Some(first_row) = rows.first() {
                    headers = (0..first_row.len()).map(|i| format!("Col{}", i)).collect();
                }
            }

            all_sheets.push(ExcelData {
                headers,
                rows,
                sheet_name: sheet_name.clone(),
            });
        }
    }

    Ok(all_sheets)
}

pub fn write_excel_file(file_path: &str, data: Vec<ExcelData>) -> Result<()> {
    let mut workbook = Workbook::new();

    for sheet_data in data {
        let worksheet = workbook.add_worksheet();
        worksheet.set_name(&sheet_data.sheet_name)?;

        // Write headers
        for (col, header) in sheet_data.headers.iter().enumerate() {
            worksheet.write_string(0, col as u16, header)?;
        }

        // Write data rows
        for (row_idx, row) in sheet_data.rows.iter().enumerate() {
            for (col_idx, value) in row.iter().enumerate() {
                let row_num = (row_idx + 1) as u32;
                let col_num = col_idx as u16;

                match value {
                    DataValue::Text(s) => { worksheet.write_string(row_num, col_num, s)?; },
                    DataValue::Number(n) => { worksheet.write_number(row_num, col_num, *n)?; },
                    DataValue::Integer(i) => { worksheet.write_number(row_num, col_num, *i as f64)?; },
                    DataValue::Boolean(b) => { worksheet.write_boolean(row_num, col_num, *b)?; },
                    DataValue::Empty => {},
                }
            }
        }
    }

    workbook.save(file_path)?;
    Ok(())
}

pub fn update_excel_cell(
    file_path: &str,
    sheet_name: &str,
    row: usize,
    col: usize,
    value: DataValue
) -> Result<()> {
    let mut sheets = read_excel_file(file_path)?;
    
    for sheet in &mut sheets {
        if sheet.sheet_name == sheet_name {
            if row > 0 && row <= sheet.rows.len() {
                let row_idx = row - 1;
                if col < sheet.rows[row_idx].len() {
                    sheet.rows[row_idx][col] = value.clone();
                }
            }
        }
    }
    
    write_excel_file(file_path, sheets)?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CellUpdate {
    pub row: usize,
    pub column: usize,
    pub value: String,
    pub header: Option<String>,
}

pub fn update_excel_cells(
    file_path: &str,
    sheet_name: &str,
    updates: Vec<CellUpdate>
) -> Result<()> {
    let mut sheets = read_excel_file(file_path)?;
    
    for sheet in &mut sheets {
        if sheet.sheet_name == sheet_name {
            for update in &updates {
                // Ensure the row exists
                while sheet.rows.len() < update.row {
                    let empty_row = vec![DataValue::Empty; sheet.headers.len()];
                    sheet.rows.push(empty_row);
                }
                
                // Ensure the column exists
                if update.row > 0 && update.row <= sheet.rows.len() {
                    let row_idx = update.row - 1;
                    while sheet.rows[row_idx].len() <= update.column {
                        sheet.rows[row_idx].push(DataValue::Empty);
                    }
                    
                    // Update the cell value
                    if update.column < sheet.rows[row_idx].len() {
                        // Try to parse as number first
                        if let Ok(num) = update.value.parse::<f64>() {
                            sheet.rows[row_idx][update.column] = DataValue::Number(num);
                        } else if update.value.to_lowercase() == "true" {
                            sheet.rows[row_idx][update.column] = DataValue::Boolean(true);
                        } else if update.value.to_lowercase() == "false" {
                            sheet.rows[row_idx][update.column] = DataValue::Boolean(false);
                        } else if update.value.is_empty() {
                            sheet.rows[row_idx][update.column] = DataValue::Empty;
                        } else {
                            sheet.rows[row_idx][update.column] = DataValue::Text(update.value.clone());
                        }
                    }
                }
            }
        }
    }
    
    write_excel_file(file_path, sheets)?;
    Ok(())
}