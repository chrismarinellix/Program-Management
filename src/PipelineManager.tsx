import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PipelineRow {
  rowIndex: number;
  data: any[];
  edited: boolean;
}

interface Filter {
  columnIndex: number;
  value: string;
  type: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
}

interface EditCell {
  rowIndex: number;
  columnIndex: number;
  value: any;
  originalValue: any;
}

function PipelineManager({ data }: { data?: any }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<PipelineRow[]>([]);
  const [filters, setFilters] = useState<Map<number, Filter>>(new Map());
  const [editedCells, setEditedCells] = useState<Map<string, EditCell>>(new Map());
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnWidths, setColumnWidths] = useState<Map<number, number>>(new Map());
  const [globalFilter, setGlobalFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());

  // Load Pipeline data from cached data or fetch if needed
  const loadPipelineData = async () => {
    try {
      let pipelineData;
      
      if (data?.pmData) {
        // Use cached data
        pipelineData = data.pmData;
      } else {
        // Fallback to fetching
        const filePath = '/Users/chris/Downloads/Program_Management.xlsm';
        pipelineData = await invoke('read_excel', { filePath });
      }
      
      // Find the Pipeline sheet
      let pipelineSheet = null;
      for (const sheet of (pipelineData as any[])) {
        if (sheet.sheet_name && sheet.sheet_name.toLowerCase().includes('pipeline')) {
          pipelineSheet = sheet;
          break;
        }
      }
      
      if (!pipelineSheet) {
        // If no pipeline sheet, use the first sheet
        pipelineSheet = (pipelineData as any[])[0];
      }
      
      if (pipelineSheet) {
        console.log('Pipeline sheet found:', pipelineSheet.sheet_name);
        console.log('Headers from backend:', pipelineSheet.headers);
        console.log('Number of data rows:', pipelineSheet.rows?.length);
        
        // The backend already extracts headers from row 11 for pipeline sheets
        // So pipelineSheet.headers should contain the correct headers
        setHeaders(pipelineSheet.headers || []);
        
        // Convert rows to PipelineRow format
        // Note: These are the data rows (starting from row 12 in Excel)
        const pipelineRows: PipelineRow[] = (pipelineSheet.rows || []).map((row: any[], index: number) => ({
          rowIndex: index,
          data: row.map((cell: any) => getCellValue(cell)),
          edited: false
        }));
        
        setRows(pipelineRows);
        setFilteredRows(pipelineRows);
        
        // Set default column widths based on content
        const widths = new Map<number, number>();
        pipelineSheet.headers.forEach((header: string, index: number) => {
          // Calculate width based on header length and sample data
          let maxLength = header.length;
          pipelineRows.slice(0, 10).forEach(row => {
            const cellLength = String(row.data[index] || '').length;
            maxLength = Math.max(maxLength, cellLength);
          });
          widths.set(index, Math.min(300, Math.max(100, maxLength * 8)));
        });
        setColumnWidths(widths);
        
        setStatus(`${pipelineRows.length} rows loaded from Pipeline`);
      }
    } catch (error: any) {
      console.error('Error loading pipeline data:', error);
      setStatus(`Error: ${error?.message || error}`);
    }
  };

  // Remove loadProjectData as we use cached data now

  useEffect(() => {
    loadPipelineData();
  }, [data]);

  const getCellValue = (cell: any): any => {
    if (!cell) return '';
    if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') return cell;
    if (cell.Text !== undefined) return cell.Text;
    if (cell.Number !== undefined) return cell.Number;
    if (cell.DateTime !== undefined) return new Date(cell.DateTime).toLocaleDateString();
    if (cell.Bool !== undefined) return cell.Bool;
    return String(cell);
  };

  // Handle cell editing
  const handleCellEdit = (rowIndex: number, columnIndex: number, newValue: string) => {
    const key = `${rowIndex}-${columnIndex}`;
    const originalValue = rows[rowIndex].data[columnIndex];
    
    // Update the cell value
    const updatedRows = [...rows];
    updatedRows[rowIndex].data[columnIndex] = newValue;
    updatedRows[rowIndex].edited = true;
    setRows(updatedRows);
    
    // Track the edit
    const edit: EditCell = {
      rowIndex,
      columnIndex,
      value: newValue,
      originalValue
    };
    
    const newEdits = new Map(editedCells);
    newEdits.set(key, edit);
    setEditedCells(newEdits);
    
    // Re-apply filters
    applyFilters(updatedRows);
  };

  // Apply filters to rows
  const applyFilters = useCallback((rowsToFilter: PipelineRow[] = rows) => {
    let filtered = [...rowsToFilter];
    
    // Apply global filter first
    if (globalFilter.trim()) {
      const searchTerm = globalFilter.toLowerCase();
      filtered = filtered.filter(row => {
        // If columns are selected, only search in those columns
        if (selectedColumns.size > 0) {
          return Array.from(selectedColumns).some(colIndex => 
            String(row.data[colIndex] || '').toLowerCase().includes(searchTerm)
          );
        }
        // Otherwise search all columns
        return row.data.some(cell => 
          String(cell || '').toLowerCase().includes(searchTerm)
        );
      });
    }
    
    // Apply column-specific filters
    if (filters.size > 0) {
      filtered = filtered.filter(row => {
        for (const [columnIndex, filter] of filters) {
          const cellValue = String(row.data[columnIndex] || '').toLowerCase();
          const filterValue = filter.value.toLowerCase();
          
          switch (filter.type) {
            case 'contains':
              if (!cellValue.includes(filterValue)) return false;
              break;
            case 'equals':
              if (cellValue !== filterValue) return false;
              break;
            case 'startsWith':
              if (!cellValue.startsWith(filterValue)) return false;
              break;
            case 'endsWith':
              if (!cellValue.endsWith(filterValue)) return false;
              break;
            case 'greaterThan':
              if (Number(cellValue) <= Number(filterValue)) return false;
              break;
            case 'lessThan':
              if (Number(cellValue) >= Number(filterValue)) return false;
              break;
          }
        }
        return true;
      });
    }
    
    setFilteredRows(filtered);
  }, [filters, rows, globalFilter, selectedColumns]);

  // Handle filter changes
  const handleFilterChange = (columnIndex: number, value: string, type: Filter['type'] = 'contains') => {
    const newFilters = new Map(filters);
    
    if (value === '') {
      newFilters.delete(columnIndex);
    } else {
      newFilters.set(columnIndex, { columnIndex, value, type });
    }
    
    setFilters(newFilters);
  };

  useEffect(() => {
    applyFilters();
  }, [filters, applyFilters, globalFilter, selectedColumns]);

  // Sort functionality
  const handleSort = (columnIndex: number) => {
    const newDirection = sortColumn === columnIndex && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(columnIndex);
    setSortDirection(newDirection);
    
    const sorted = [...filteredRows].sort((a, b) => {
      const aVal = a.data[columnIndex];
      const bVal = b.data[columnIndex];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return newDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal);
      const bStr = String(bVal);
      return newDirection === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    
    setFilteredRows(sorted);
  };

  // Save changes back to Excel
  const saveChanges = async () => {
    if (editedCells.size === 0) {
      setStatus('No changes to save');
      return;
    }
    
    setSaving(true);
    setStatus('Saving changes to Excel...');
    
    try {
      // Prepare data for saving
      const updates: any[] = [];
      editedCells.forEach((edit, key) => {
        updates.push({
          row: edit.rowIndex,
          column: edit.columnIndex,
          value: edit.value,
          header: headers[edit.columnIndex]
        });
      });
      
      // Call Rust backend to update Excel
      await invoke('update_excel_cells', {
        filePath: '/Users/chris/Downloads/Program_Management.xlsm',
        sheetName: 'Pipeline',
        updates: updates
      });
      
      // Clear edited status
      const clearedRows = rows.map(row => ({ ...row, edited: false }));
      setRows(clearedRows);
      setFilteredRows(clearedRows);
      setEditedCells(new Map());
      
      setStatus(`Saved ${editedCells.size} changes to Excel`);
      setSaving(false);
    } catch (error: any) {
      console.error('Error saving changes:', error);
      setStatus(`Error saving: ${error?.message || error}`);
      setSaving(false);
    }
  };

  // Export filtered data
  const exportFiltered = () => {
    const csvContent = [
      headers.join(','),
      ...filteredRows.map(row => 
        row.data.map(cell => 
          typeof cell === 'string' && cell.includes(',') 
            ? `"${cell}"` 
            : cell
        ).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pipeline_filtered.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Column resize handling
  const handleColumnResize = (columnIndex: number, newWidth: number) => {
    const newWidths = new Map(columnWidths);
    newWidths.set(columnIndex, Math.max(50, newWidth));
    setColumnWidths(newWidths);
  };

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f1f5f9',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>

      <div style={{ padding: '20px', flex: 1, overflow: 'auto' }}>
        {headers.length > 0 && (
          <>
            {/* Enhanced Filter Bar */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '12px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              {/* Global Search */}
              <div style={{ marginBottom: '15px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="🔍 Search all columns..."
                    value={globalFilter}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setGlobalFilter(newValue);
                      // Apply global filter immediately
                      const newFilters = new Map(filters);
                      applyFilters(newFilters, newValue);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '14px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.backgroundColor = 'white';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.backgroundColor = '#f8fafc';
                    }}
                  />
                </div>
              </div>

              {/* Advanced Filters Toggle */}
              <div style={{ marginBottom: '15px' }}>
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#475569'
                  }}
                >
                  {showAdvancedFilters ? '▼' : '▶'} Advanced Filters
                </button>
              </div>

              {/* Column Selection (shown when advanced filters are active) */}
              {showAdvancedFilters && (
                <div style={{
                  padding: '15px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <div style={{ marginBottom: '10px', fontWeight: '600', fontSize: '13px', color: '#475569' }}>
                    Select columns to display:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {headers.map((header, index) => (
                      <label key={index} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '5px',
                        padding: '5px 10px',
                        backgroundColor: selectedColumns.has(index) || selectedColumns.size === 0 ? '#3b82f6' : 'white',
                        color: selectedColumns.has(index) || selectedColumns.size === 0 ? 'white' : '#475569',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        fontSize: '12px',
                        transition: 'all 0.2s'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedColumns.size === 0 || selectedColumns.has(index)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedColumns);
                            if (selectedColumns.size === 0) {
                              // If all are selected, unselect all except this one
                              headers.forEach((_, i) => {
                                if (i !== index) newSelected.add(i);
                              });
                              newSelected.delete(index);
                            } else {
                              if (e.target.checked) {
                                newSelected.delete(index);
                              } else {
                                newSelected.add(index);
                              }
                            }
                            setSelectedColumns(newSelected.size === headers.length ? new Set() : newSelected);
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        {header}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600' }}>
                    {filteredRows.length} / {rows.length} rows
                  </span>
                  {editedCells.size > 0 && (
                    <span style={{ 
                      padding: '4px 12px',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {editedCells.size} unsaved changes
                    </span>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      setGlobalFilter('');
                      setFilters(new Map());
                      setSelectedColumns(new Set());
                      setFilteredRows(rows);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Clear All
                  </button>
                  <button
                    onClick={exportFiltered}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Export Filtered
                  </button>
                  <button
                    onClick={saveChanges}
                    disabled={editedCells.size === 0 || saving}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: editedCells.size > 0 ? '#3b82f6' : '#94a3b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: editedCells.size > 0 ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>

            {/* Data Grid */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ overflowX: 'auto', maxHeight: '70vh', position: 'relative' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ 
                    position: 'sticky', 
                    top: 0, 
                    backgroundColor: '#f8fafc',
                    zIndex: 10
                  }}>
                    <tr>
                      {headers.map((header, index) => {
                        // Skip column if not selected in advanced filters
                        if (selectedColumns.size > 0 && !selectedColumns.has(index)) {
                          return null;
                        }
                        return (
                        <th 
                          key={index}
                          style={{ 
                            padding: '12px',
                            textAlign: 'left',
                            borderBottom: '2px solid #e5e7eb',
                            borderRight: '1px solid #e5e7eb',
                            backgroundColor: '#f8fafc',
                            minWidth: columnWidths.get(index) || 150,
                            position: 'relative',
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            marginBottom: '8px'
                          }}>
                            <span 
                              onClick={() => handleSort(index)}
                              style={{ 
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '13px',
                                color: '#1e293b'
                              }}
                            >
                              {header}
                              {sortColumn === index && (
                                <span style={{ marginLeft: '5px' }}>
                                  {sortDirection === 'asc' ? '▲' : '▼'}
                                </span>
                              )}
                            </span>
                            
                            {/* Column resizer */}
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '5px',
                                cursor: 'col-resize',
                                backgroundColor: 'transparent'
                              }}
                              onMouseDown={(e) => {
                                const startX = e.pageX;
                                const startWidth = columnWidths.get(index) || 150;
                                
                                const handleMouseMove = (e: MouseEvent) => {
                                  const diff = e.pageX - startX;
                                  handleColumnResize(index, startWidth + diff);
                                };
                                
                                const handleMouseUp = () => {
                                  document.removeEventListener('mousemove', handleMouseMove);
                                  document.removeEventListener('mouseup', handleMouseUp);
                                };
                                
                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                              }}
                            />
                          </div>
                          
                          {/* Filter input */}
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={filters.get(index)?.value || ''}
                            onChange={(e) => handleFilterChange(index, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              backgroundColor: 'white'
                            }}
                          />
                        </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, rowIndex) => (
                      <tr 
                        key={row.rowIndex}
                        style={{ 
                          backgroundColor: row.edited ? '#fef3c7' : (rowIndex % 2 === 0 ? 'white' : '#f8fafc'),
                          transition: 'background-color 0.2s'
                        }}
                      >
                        {row.data.map((cell, cellIndex) => {
                          // Skip column if not selected in advanced filters
                          if (selectedColumns.size > 0 && !selectedColumns.has(cellIndex)) {
                            return null;
                          }
                          return (
                          <td 
                            key={cellIndex}
                            style={{ 
                              padding: '8px 12px',
                              borderBottom: '1px solid #e5e7eb',
                              borderRight: '1px solid #e5e7eb',
                              minWidth: columnWidths.get(cellIndex) || 150
                            }}
                          >
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) => handleCellEdit(row.rowIndex, cellIndex, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px',
                                border: '1px solid transparent',
                                backgroundColor: 'transparent',
                                fontSize: '13px',
                                transition: 'all 0.2s'
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
          </>
        )}
      </div>
    </div>
  );
}

export default PipelineManager;