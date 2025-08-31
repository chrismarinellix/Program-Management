import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ExcelEditorProps {
  data?: any;
  sheetName: string;
  filePath?: string;
}

function ExcelEditor({ data, sheetName, filePath = '/Users/chris/Downloads/Program_Management.xlsm' }: ExcelEditorProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [editedCells, setEditedCells] = useState<Map<string, any>>(new Map());
  const [filters, setFilters] = useState<Map<number, string>>(new Map());
  const [filteredRows, setFilteredRows] = useState<any[][]>([]);
  const [saving, setSaving] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<number[]>([]);

  useEffect(() => {
    loadSheetData();
  }, [data, sheetName]);

  useEffect(() => {
    applyFilters();
  }, [filters, rows]);

  const loadSheetData = () => {
    if (!data?.pmData) return;
    
    // Find the specified sheet
    let targetSheet = null;
    for (const sheet of (data.pmData as any[])) {
      if (sheet.sheet_name && sheet.sheet_name.toLowerCase().includes(sheetName.toLowerCase())) {
        targetSheet = sheet;
        break;
      }
    }
    
    if (targetSheet) {
      const allHeaders = targetSheet.headers || [];
      setHeaders(allHeaders);
      const sheetRows = targetSheet.rows || [];
      setRows(sheetRows);
      setFilteredRows(sheetRows);
      
      // For Program Management, only show specific columns
      if (sheetName.toLowerCase() === 'program') {
        const columnsToShow = [
          'owner', 'rp', 'project', 'activity', 'client', 'customer',
          'commentary', 'key commentary', 'actions', 'issues', 
          'vo', 'phase', 'target', 'timeframe', 'date', 'milestone'
        ];
        
        const visibleCols: number[] = [];
        allHeaders.forEach((header: string, index: number) => {
          const headerLower = header.toLowerCase();
          if (columnsToShow.some(col => headerLower.includes(col))) {
            visibleCols.push(index);
          }
        });
        
        // If no columns matched, show first 10 columns as fallback
        if (visibleCols.length === 0) {
          for (let i = 0; i < Math.min(10, allHeaders.length); i++) {
            visibleCols.push(i);
          }
        }
        
        setVisibleColumns(visibleCols);
      } else {
        // Show all columns for other sheets
        setVisibleColumns(allHeaders.map((_: any, i: number) => i));
      }
    }
  };

  const getCellValue = (cell: any, isDateColumn: boolean = false): string => {
    if (cell === null || cell === undefined) return '';
    
    // Handle date columns specially
    if (isDateColumn && typeof cell === 'number') {
      // Excel stores dates as numbers (days since 1900)
      const excelDate = new Date((cell - 25569) * 86400 * 1000);
      if (!isNaN(excelDate.getTime())) {
        return excelDate.toLocaleDateString('en-US', { 
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    }
    
    if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
    if (cell.Text !== undefined) return cell.Text;
    if (cell.Number !== undefined) {
      // Check if it might be a date
      if (isDateColumn && cell.Number > 40000 && cell.Number < 50000) {
        const excelDate = new Date((cell.Number - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) {
          return excelDate.toLocaleDateString('en-US', { 
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        }
      }
      return String(cell.Number);
    }
    if (cell.DateTime !== undefined) {
      // Try to parse the datetime
      const date = new Date(cell.DateTime);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { 
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      return cell.DateTime;
    }
    if (cell.Bool !== undefined) return cell.Bool ? 'TRUE' : 'FALSE';
    return JSON.stringify(cell);
  };
  
  const isDateColumn = (header: string): boolean => {
    const headerLower = header.toLowerCase();
    return headerLower.includes('date') || 
           headerLower.includes('timeframe') || 
           headerLower.includes('target') ||
           headerLower.includes('milestone');
  };

  const handleCellEdit = (rowIndex: number, colIndex: number, value: string) => {
    const key = `${rowIndex}-${colIndex}`;
    const newRows = [...rows];
    newRows[rowIndex][colIndex] = value;
    setRows(newRows);
    
    const newEdits = new Map(editedCells);
    newEdits.set(key, { row: rowIndex, col: colIndex, value });
    setEditedCells(newEdits);
  };

  const applyFilters = () => {
    if (filters.size === 0) {
      setFilteredRows(rows);
      return;
    }
    
    const filtered = rows.filter(row => {
      for (const [colIndex, filterValue] of filters) {
        const header = headers[colIndex] || '';
        const cellValue = getCellValue(row[colIndex], isDateColumn(header)).toLowerCase();
        if (!cellValue.includes(filterValue.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
    
    setFilteredRows(filtered);
  };

  const saveChanges = async () => {
    if (editedCells.size === 0) return;
    
    setSaving(true);
    try {
      const updates = Array.from(editedCells.values()).map(edit => ({
        row: edit.row + 1,
        column: edit.col,
        value: edit.value
      }));
      
      await invoke('update_excel_cells', {
        filePath,
        sheetName,
        updates
      });
      
      setEditedCells(new Map());
    } catch (error) {
      console.error('Error saving:', error);
    }
    setSaving(false);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '20px' }}>
      {/* Actions Bar */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '14px', color: '#64748b' }}>
          {filteredRows.length} rows | {editedCells.size > 0 && `${editedCells.size} changes`}
        </div>
        <button
          onClick={saveChanges}
          disabled={editedCells.size === 0 || saving}
          style={{
            padding: '8px 16px',
            backgroundColor: editedCells.size > 0 ? '#3b82f6' : '#94a3b8',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: editedCells.size > 0 ? 'pointer' : 'not-allowed',
            fontSize: '14px'
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Data Grid */}
      <div style={{ 
        flex: 1,
        backgroundColor: 'white', 
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', height: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ 
              position: 'sticky', 
              top: 0, 
              backgroundColor: '#f8fafc',
              zIndex: 10
            }}>
              <tr>
                {headers.map((header, index) => {
                  // Only show visible columns
                  if (visibleColumns.length > 0 && !visibleColumns.includes(index)) {
                    return null;
                  }
                  
                  return (
                  <th key={index} style={{ 
                    padding: '12px',
                    textAlign: 'left',
                    borderBottom: '2px solid #e5e7eb',
                    borderRight: '1px solid #e5e7eb',
                    backgroundColor: '#f8fafc',
                    minWidth: '150px'
                  }}>
                    <div style={{ marginBottom: '8px', fontWeight: '600', fontSize: '13px' }}>
                      {header}
                    </div>
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={filters.get(index) || ''}
                      onChange={(e) => {
                        const newFilters = new Map(filters);
                        if (e.target.value) {
                          newFilters.set(index, e.target.value);
                        } else {
                          newFilters.delete(index);
                        }
                        setFilters(newFilters);
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        fontSize: '12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px'
                      }}
                    />
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rowIndex) => (
                <tr key={rowIndex} style={{ 
                  backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f8fafc'
                }}>
                  {row.map((cell, colIndex) => {
                    // Only show visible columns
                    if (visibleColumns.length > 0 && !visibleColumns.includes(colIndex)) {
                      return null;
                    }
                    
                    const key = `${rowIndex}-${colIndex}`;
                    const isEdited = editedCells.has(key);
                    const header = headers[colIndex] || '';
                    const dateCol = isDateColumn(header);
                    
                    return (
                      <td key={colIndex} style={{ 
                        padding: '8px 12px',
                        borderBottom: '1px solid #e5e7eb',
                        borderRight: '1px solid #e5e7eb',
                        backgroundColor: isEdited ? '#fef3c7' : 'inherit'
                      }}>
                        <input
                          type="text"
                          value={getCellValue(cell, dateCol)}
                          onChange={(e) => handleCellEdit(rowIndex, colIndex, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px',
                            border: '1px solid transparent',
                            backgroundColor: 'transparent',
                            fontSize: '13px'
                          }}
                          onFocus={(e) => {
                            e.target.style.border = '1px solid #3b82f6';
                            e.target.style.backgroundColor = 'white';
                          }}
                          onBlur={(e) => {
                            e.target.style.border = '1px solid transparent';
                            e.target.style.backgroundColor = 'transparent';
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ExcelEditor;