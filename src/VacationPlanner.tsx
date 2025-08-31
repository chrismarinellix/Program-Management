import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface VacationPlannerProps {
  data?: any;
}

interface DateRange {
  employeeName: string;
  startDate: Date;
  endDate: Date;
  rowIndex: number;
}

function VacationPlanner({ data }: VacationPlannerProps) {
  const [vacationData, setVacationData] = useState<any>(null);
  const [dates, setDates] = useState<Date[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [vacationGrid, setVacationGrid] = useState<any[][]>([]);
  const [selectedRanges, setSelectedRanges] = useState<DateRange[]>([]);
  const [editedCells, setEditedCells] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState<{row: number, col: number} | null>(null);

  useEffect(() => {
    loadVacationData();
  }, [data]);

  const loadVacationData = () => {
    if (!data?.pmData) return;
    
    // Find vacation planner sheet
    let vacationSheet = null;
    for (const sheet of (data.pmData as any[])) {
      if (sheet.sheet_name && sheet.sheet_name.toLowerCase().includes('vacation')) {
        vacationSheet = sheet;
        break;
      }
    }
    
    if (vacationSheet) {
      setVacationData(vacationSheet);
      
      // Parse dates from row 1
      if (vacationSheet.rows && vacationSheet.rows.length > 0) {
        const dateRow = vacationSheet.rows[0];
        const parsedDates: Date[] = [];
        
        dateRow.forEach((cell: any, index: number) => {
          if (index > 0) { // Skip first column (employee names)
            const cellValue = getCellValue(cell);
            if (cellValue) {
              const date = parseDate(cellValue);
              if (date) parsedDates.push(date);
            }
          }
        });
        
        setDates(parsedDates);
        
        // Get employee names from first column
        const empNames: string[] = [];
        const grid: any[][] = [];
        
        for (let i = 1; i < vacationSheet.rows.length; i++) {
          const row = vacationSheet.rows[i];
          if (row[0]) {
            const name = getCellValue(row[0]);
            if (name) {
              empNames.push(name);
              grid.push(row.slice(1)); // Store row data excluding name
            }
          }
        }
        
        setEmployees(empNames);
        setVacationGrid(grid);
      }
    }
  };

  const getCellValue = (cell: any): string => {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
    if (cell.Text !== undefined) return cell.Text;
    if (cell.Number !== undefined) return String(cell.Number);
    if (cell.DateTime !== undefined) return cell.DateTime;
    return '';
  };

  const parseDate = (dateStr: string): Date | null => {
    try {
      // Try various date formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) return date;
      
      // Try parsing as Excel serial number
      const excelSerial = parseFloat(dateStr);
      if (!isNaN(excelSerial)) {
        const excelDate = new Date((excelSerial - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) return excelDate;
      }
    } catch (e) {
      console.error('Error parsing date:', dateStr, e);
    }
    return null;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleCellClick = (rowIndex: number, colIndex: number) => {
    const key = `${rowIndex}-${colIndex}`;
    const currentValue = getCellValue(vacationGrid[rowIndex][colIndex]);
    
    // Toggle vacation marking
    const newValue = currentValue ? '' : 'V';
    
    const newGrid = [...vacationGrid];
    newGrid[rowIndex][colIndex] = newValue;
    setVacationGrid(newGrid);
    
    const newEdits = new Map(editedCells);
    newEdits.set(key, newValue);
    setEditedCells(newEdits);
  };

  const handleRangeSelect = (rowIndex: number, startCol: number, endCol: number) => {
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    
    const newGrid = [...vacationGrid];
    const newEdits = new Map(editedCells);
    
    for (let col = minCol; col <= maxCol; col++) {
      const key = `${rowIndex}-${col}`;
      newGrid[rowIndex][col] = 'V';
      newEdits.set(key, 'V');
    }
    
    setVacationGrid(newGrid);
    setEditedCells(newEdits);
  };

  const handleMouseDown = (rowIndex: number, colIndex: number) => {
    setSelecting(true);
    setSelectStart({ row: rowIndex, col: colIndex });
  };

  const handleMouseUp = (rowIndex: number, colIndex: number) => {
    if (selecting && selectStart) {
      if (selectStart.row === rowIndex) {
        handleRangeSelect(rowIndex, selectStart.col, colIndex);
      }
      setSelecting(false);
      setSelectStart(null);
    }
  };

  const handleMouseEnter = (rowIndex: number, colIndex: number) => {
    if (selecting && selectStart && selectStart.row === rowIndex) {
      // Visual feedback during selection
    }
  };

  const clearRow = (rowIndex: number) => {
    const newGrid = [...vacationGrid];
    const newEdits = new Map(editedCells);
    
    for (let col = 0; col < newGrid[rowIndex].length; col++) {
      const key = `${rowIndex}-${col}`;
      newGrid[rowIndex][col] = '';
      newEdits.set(key, '');
    }
    
    setVacationGrid(newGrid);
    setEditedCells(newEdits);
  };

  const saveChanges = async () => {
    if (editedCells.size === 0) return;
    
    setSaving(true);
    try {
      const updates: any[] = [];
      
      editedCells.forEach((value, key) => {
        const [row, col] = key.split('-').map(Number);
        updates.push({
          row: row + 2, // +1 for header row, +1 for 1-based indexing
          column: parseInt(col) + 1, // +1 for employee name column
          value: value
        });
      });
      
      await invoke('update_excel_cells', {
        filePath: '/Users/chris/Downloads/Program_Management.xlsm',
        sheetName: 'Vacation',
        updates
      });
      
      setEditedCells(new Map());
    } catch (error) {
      console.error('Error saving vacation data:', error);
    }
    setSaving(false);
  };

  const getCellStyle = (rowIndex: number, colIndex: number) => {
    const value = getCellValue(vacationGrid[rowIndex][colIndex]);
    const key = `${rowIndex}-${colIndex}`;
    const isEdited = editedCells.has(key);
    
    return {
      width: '30px',
      height: '30px',
      border: '1px solid #e5e7eb',
      textAlign: 'center' as const,
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: value ? 'bold' : 'normal',
      backgroundColor: value ? '#fb923c' : (isEdited ? '#fef3c7' : 'white'),
      color: value ? 'white' : '#6b7280',
      userSelect: 'none' as const,
      transition: 'all 0.1s'
    };
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: '600' }}>
          Vacation Planner
        </h2>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            Click or drag to select vacation dates. Orange cells indicate vacation days.
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
            {saving ? 'Saving...' : `Save Changes (${editedCells.size})`}
          </button>
        </div>
      </div>

      {/* Vacation Grid */}
      <div style={{ 
        flex: 1,
        backgroundColor: 'white',
        borderRadius: '8px',
        overflow: 'auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ 
                position: 'sticky',
                left: 0,
                backgroundColor: '#f8fafc',
                padding: '10px',
                borderRight: '2px solid #e5e7eb',
                borderBottom: '2px solid #e5e7eb',
                minWidth: '150px',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: '600',
                zIndex: 2
              }}>
                Employee
              </th>
              {dates.map((date, index) => (
                <th key={index} style={{ 
                  padding: '4px',
                  backgroundColor: '#f8fafc',
                  borderBottom: '2px solid #e5e7eb',
                  borderRight: '1px solid #e5e7eb',
                  fontSize: '11px',
                  fontWeight: '500',
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  height: '80px',
                  width: '30px'
                }}>
                  {formatDate(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, rowIndex) => (
              <tr key={rowIndex}>
                <td style={{ 
                  position: 'sticky',
                  left: 0,
                  backgroundColor: 'white',
                  padding: '10px',
                  borderRight: '2px solid #e5e7eb',
                  borderBottom: '1px solid #e5e7eb',
                  fontWeight: '500',
                  fontSize: '13px',
                  zIndex: 1
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {employee}
                    <button
                      onClick={() => clearRow(rowIndex)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </td>
                {vacationGrid[rowIndex] && vacationGrid[rowIndex].map((cell, colIndex) => (
                  <td 
                    key={colIndex}
                    onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                    onMouseUp={() => handleMouseUp(rowIndex, colIndex)}
                    onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                    onClick={() => !selecting && handleCellClick(rowIndex, colIndex)}
                    style={getCellStyle(rowIndex, colIndex)}
                  >
                    {getCellValue(cell) ? '●' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ 
        marginTop: '20px',
        padding: '15px',
        backgroundColor: 'white',
        borderRadius: '8px',
        display: 'flex',
        gap: '30px',
        fontSize: '13px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            backgroundColor: '#fb923c',
            borderRadius: '4px'
          }}></div>
          <span>Vacation Day</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            backgroundColor: '#fef3c7',
            borderRadius: '4px',
            border: '1px solid #fbbf24'
          }}></div>
          <span>Unsaved Change</span>
        </div>
        <div style={{ color: '#6b7280' }}>
          Click to toggle single day | Click and drag to select range
        </div>
      </div>
    </div>
  );
}

export default VacationPlanner;