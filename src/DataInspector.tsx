import React, { useEffect, useState } from 'react';
import DataSourceTable from './components/DataSourceTable';
import { columnMappings } from './config/dataSourceMapping';
import { ColumnMappingService } from './services/columnMappingService';

interface DataInspectorProps {
  data: any;
}

const DataInspector: React.FC<DataInspectorProps> = ({ data }) => {
  const [sheetReports, setSheetReports] = useState<any[]>([]);
  const [pmSheets, setPmSheets] = useState<any[]>([]);
  const [showColumnEditor, setShowColumnEditor] = useState(false);
  const [editableColumnMappings, setEditableColumnMappings] = useState(ColumnMappingService.getColumnMappings());

  useEffect(() => {
    console.log('DataInspector received data:', data);
    if (!data) {
      console.log('DataInspector: No data received');
      setSheetReports([{
        name: 'No Data Loaded',
        error: 'No data has been loaded. Please check if Excel files are being read correctly.'
      }]);
      return;
    }

    const reports = [];

    // Analyze each sheet with proper workbook names
    const sheets = [
      { key: 'p', workbook: 'P.xlsx', description: 'Projects Master Data' },
      { key: 'pt', workbook: 'PT.xlsx', description: 'Project Transactions (Actuals)' },
      { key: 'ae', workbook: 'AE.xlsx', description: 'Activities Estimates (Budget)' }
    ];
    
    // Handle Program Management sheets separately
    const programSheets = [];
    if (data.pmData && Array.isArray(data.pmData)) {
      data.pmData.forEach((sheet: any, index: number) => {
        const sheetName = sheet.sheet_name || `Sheet${index}`;
        const headerRow = getSheetHeaderRow(sheetName);
        
        programSheets.push({
          name: sheetName,
          headerRow,
          totalRows: sheet.rows?.length || 0,
          totalColumns: sheet.rows?.[headerRow - 1]?.length || 0,
          headers: sheet.headers || [],
          firstDataRows: getFirstDataRows(sheet, headerRow),
          sampleData: sheet.rows?.slice(headerRow, headerRow + 3) || []
        });
      });
    }
    
    // Also check individual sheet references
    ['pipeline', 'program', 'vacation'].forEach(key => {
      if (data[key]) {
        const sheet = data[key];
        const sheetName = sheet.sheet_name || key;
        const headerRow = getSheetHeaderRow(sheetName);
        
        // Avoid duplicates
        if (!programSheets.find(s => s.name === sheetName)) {
          programSheets.push({
            name: sheetName,
            headerRow,
            totalRows: sheet.rows?.length || 0,
            totalColumns: sheet.rows?.[headerRow - 1]?.length || 0,
            headers: sheet.headers || [],
            firstDataRows: getFirstDataRows(sheet, headerRow),
            sampleData: sheet.rows?.slice(headerRow, headerRow + 3) || []
          });
        }
      }
    });
    
    setPmSheets(programSheets);
    
    sheets.forEach(({ key: sheetKey, workbook, description }) => {
      const sheetData = data[sheetKey];
      if (!sheetData) {
        reports.push({
          name: `${workbook} - ${description}`,
          workbook: workbook,
          error: 'Sheet not found in data'
        });
        return;
      }

      const report: any = {
        name: `${workbook} - ${sheetData.sheet_name || 'Sheet0'}`,
        workbook: workbook,
        description: description,
        totalRows: sheetData.rows?.length || 0,
        totalColumns: sheetData.rows?.[0]?.length || 0,
        headers: [],
        firstDataRows: [],
        columnAnalysis: []
      };

      // Get headers from row 0 (first row)
      if (sheetData.rows && sheetData.rows.length > 0) {
        const headerRow = sheetData.rows[0];
        report.headers = headerRow.map((cell: any, idx: number) => ({
          index: idx,
          column: String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? String.fromCharCode(65 + Math.floor(idx / 26) - 1) : ''),
          value: cell === null || cell === undefined ? '<empty>' : String(cell),
          type: typeof cell
        }));

        // Get first 3 data rows
        for (let i = 1; i <= Math.min(3, sheetData.rows.length - 1); i++) {
          const row = sheetData.rows[i];
          report.firstDataRows.push({
            rowNumber: i + 1, // Excel-style numbering (1-based)
            data: row.map((cell: any, idx: number) => ({
              column: String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? String.fromCharCode(65 + Math.floor(idx / 26) - 1) : ''),
              value: cell === null || cell === undefined ? '<empty>' : String(cell).substring(0, 50),
              type: typeof cell
            }))
          });
        }

        // Analyze specific columns for budget tracker
        if (sheetKey === 'ae') {
          report.columnAnalysis = [
            { column: 'B (index 1)', purpose: 'Project', sample: sheetData.rows[1]?.[1] },
            { column: 'C (index 2)', purpose: 'Project Description', sample: sheetData.rows[1]?.[2] },
            { column: 'F (index 5)', purpose: 'Activity', sample: sheetData.rows[1]?.[5] },
            { column: 'G (index 6)', purpose: 'Activity Description', sample: sheetData.rows[1]?.[6] },
            { column: 'K (index 10)', purpose: 'Estimated Cost', sample: sheetData.rows[1]?.[10] },
            { column: 'L (index 11)', purpose: 'Estimated Revenue', sample: sheetData.rows[1]?.[11] },
            { column: 'M (index 12)', purpose: 'Estimated Hours', sample: sheetData.rows[1]?.[12] },
            { column: 'S (index 18)', purpose: 'Activity Seq', sample: sheetData.rows[1]?.[18] }
          ];
        } else if (sheetKey === 'pt') {
          report.columnAnalysis = [
            { column: 'E (index 4)', purpose: 'Activity Seq', sample: sheetData.rows[1]?.[4] },
            { column: 'S (index 18)', purpose: 'Internal Quantity (Hours)', sample: sheetData.rows[1]?.[18] },
            { column: 'Y (index 24)', purpose: 'Internal Amount (Cost)', sample: sheetData.rows[1]?.[24] },
            { column: 'AI (index 34)', purpose: 'Sales Amount (Revenue)', sample: sheetData.rows[1]?.[34] }
          ];
        }
      }

      reports.push(report);
    });

    setSheetReports(reports);
  }, [data]);
  
  const getSheetHeaderRow = (sheetName: string): number => {
    const name = sheetName.toLowerCase();
    if (name.includes('pipeline')) return 11;
    if (name.includes('program') && (name.includes('quick') || name.includes('view'))) return 3;
    return 1;
  };
  
  const getFirstDataRows = (sheet: any, headerRow: number) => {
    if (!sheet.rows) return [];
    
    const dataStartRow = headerRow;
    const rows = [];
    
    for (let i = dataStartRow; i < Math.min(dataStartRow + 3, sheet.rows.length); i++) {
      if (sheet.rows[i]) {
        rows.push({
          rowNumber: i + 1,
          data: sheet.rows[i].map((cell: any, idx: number) => ({
            column: getExcelColumn(idx),
            value: cell === null || cell === undefined ? '<empty>' : String(cell).substring(0, 50),
            type: typeof cell
          }))
        });
      }
    }
    return rows;
  };
  
  const getExcelColumn = (index: number): string => {
    let column = '';
    while (index >= 0) {
      column = String.fromCharCode(65 + (index % 26)) + column;
      index = Math.floor(index / 26) - 1;
    }
    return column;
  };
  
  const updateColumnMapping = (file: string, column: string, mapping: string) => {
    setEditableColumnMappings(prev => ({
      ...prev,
      [file]: {
        ...prev[file],
        [column]: mapping
      }
    }));
  };
  
  const saveColumnMappings = () => {
    const success = ColumnMappingService.saveColumnMappings(editableColumnMappings);
    if (success) {
      alert('Column mappings saved successfully! Changes will be reflected throughout the application.');
      setShowColumnEditor(false);
    } else {
      alert('Error saving column mappings. Please try again.');
    }
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
      fontFamily: 'monospace'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#1f2937' }}>📋 Data Inspector - Sheet Analysis Report</h1>
        <button
          onClick={() => setShowColumnEditor(!showColumnEditor)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ⚙️ {showColumnEditor ? 'Hide' : 'Edit'} Column Mappings
        </button>
      </div>
      
      {/* Add the new Data Source Table */}
      <DataSourceTable />
      
      {/* Column Mapping Editor */}
      {showColumnEditor && (
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '2px solid #3b82f6'
        }}>
          <h2 style={{ color: '#1f2937', marginBottom: '15px' }}>⚙️ Column Mapping Editor</h2>
          <p style={{ marginBottom: '20px', color: '#6b7280' }}>
            Edit column mappings that are used throughout the application for calculations and data processing.
          </p>
          
          {Object.entries(editableColumnMappings).map(([fileName, mappings]) => (
            <div key={fileName} style={{
              backgroundColor: 'white',
              padding: '15px',
              marginBottom: '15px',
              borderRadius: '6px',
              border: '1px solid #d1d5db'
            }}>
              <h3 style={{ color: '#374151', marginBottom: '10px' }}>{fileName}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
                {Object.entries(mappings as Record<string, string>).map(([column, mapping]) => (
                  <div key={column} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '30px' }}>{column}:</span>
                    <input
                      type="text"
                      value={mapping}
                      onChange={(e) => updateColumnMapping(fileName, column, e.target.value)}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={saveColumnMappings}
              style={{
                padding: '10px 20px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              💾 Save Mappings
            </button>
            <button
              onClick={() => {
                const defaultMappings = ColumnMappingService.resetToDefaults();
                setEditableColumnMappings(defaultMappings);
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              🔄 Reset to Default
            </button>
            <button
              onClick={() => {
                const exported = ColumnMappingService.exportMappings();
                navigator.clipboard.writeText(exported);
                alert('Column mappings copied to clipboard!');
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              📋 Export
            </button>
          </div>
        </div>
      )}
      
      <hr style={{ margin: '40px 0', border: 'none', borderTop: '2px solid #e5e7eb' }} />
      
      {/* Data Source Matrix */}
      <div style={{
        backgroundColor: '#e8f5e9',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#2e7d32', marginBottom: '15px' }}>🔄 Data Source Matrix - Where Data Comes From</h2>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#4caf50', color: 'white' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Tab/Module</th>
              <th style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Primary Data Source</th>
              <th style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Secondary Data Source</th>
              <th style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Key Columns Used</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>What It Shows & Why</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>📊 Projects Dashboard</td>
              <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>P.xlsx (Projects Master)</td>
              <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>PT.xlsx (Transactions)</td>
              <td style={{ padding: '10px', fontSize: '12px', borderRight: '1px solid #ddd' }}>
                P: Col A (Project ID), Col B (Name), Col J (Status)<br/>
                PT: Col E (Activity Seq), Col Y (Cost), Col AI (Revenue)
              </td>
              <td style={{ padding: '10px', fontSize: '12px', backgroundColor: '#f0f8ff' }}>
                <strong>Shows:</strong> All active projects with financial summaries<br/>
                <strong>Why:</strong> Provides high-level overview of project portfolio, tracks spending vs budget, identifies projects needing attention
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f5f5f5' }}>
              <td style={{ padding: '10px', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>💰 Budget Tracker</td>
              <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>AE.xlsx (Budget/Estimates)</td>
              <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>PT.xlsx (Actuals)</td>
              <td style={{ padding: '10px', fontSize: '12px', borderRight: '1px solid #ddd' }}>
                AE: Col S (Activity Seq), Col K (Est Cost), Col L (Est Revenue)<br/>
                PT: Col E (Activity Seq), Col Y (Actual Cost), Col AI (Actual Revenue)
              </td>
              <td style={{ padding: '10px', fontSize: '12px', backgroundColor: '#fff5ee' }}>
                <strong>Shows:</strong> Budget vs Actual comparison by activity<br/>
                <strong>Why:</strong> Monitors budget consumption, identifies overruns, tracks T&E fees, enables proactive cost management
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>🔄 Pipeline Manager</td>
              <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>Program_Management.xlsm</td>
              <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>P.xlsx (Projects)</td>
              <td style={{ padding: '10px', fontSize: '12px', borderRight: '1px solid #ddd' }}>
                Row 11: Headers<br/>
                Columns: Project stages, dates, status
              </td>
              <td style={{ padding: '10px', fontSize: '12px', backgroundColor: '#f0fff4' }}>
                <strong>Shows:</strong> Project pipeline stages from opportunity to completion<br/>
                <strong>Why:</strong> Tracks project progression through lifecycle, forecasts resource needs, identifies bottlenecks in workflow
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f5f5f5' }}>
              <td style={{ padding: '10px', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>🏖️ Vacation Planner</td>
              <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>Program_Management.xlsm</td>
              <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>-</td>
              <td style={{ padding: '10px', fontSize: '12px', borderRight: '1px solid #ddd' }}>
                Row 1: Dates<br/>
                Col A: Employee names<br/>
                Data cells: Leave types
              </td>
              <td style={{ padding: '10px', fontSize: '12px', backgroundColor: '#fef3ff' }}>
                <strong>Shows:</strong> Team availability calendar with leave schedules<br/>
                <strong>Why:</strong> Prevents resource conflicts, ensures adequate coverage, helps plan project timelines around team availability
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>📈 Program Management</td>
              <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>Program_Management.xlsm</td>
              <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>All sheets</td>
              <td style={{ padding: '10px', fontSize: '12px', borderRight: '1px solid #ddd' }}>
                <strong>Headers in Row 3:</strong><br/>
                Owner/AP | Project/Activity | Client | Key Commentary | Actions | Status/RAG | VD | Phase | Stage | etc.<br/>
                Data starts Row 4
              </td>
              <td style={{ padding: '10px', fontSize: '12px', backgroundColor: '#fff9e6' }}>
                <strong>Shows:</strong> Comprehensive program status with RAG ratings, actions, and commentary<br/>
                <strong>Why:</strong> Provides executive-level oversight, tracks deliverables and milestones, manages risks and action items across all projects
              </td>
            </tr>
          </tbody>
        </table>
        
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
          fontSize: '13px'
        }}>
          <strong>📌 Key Insights:</strong>
          <ul style={{ marginTop: '5px', marginLeft: '20px' }}>
            <li><strong>Activity Seq</strong> is the primary JOIN key between AE (budget) and PT (actuals)</li>
            <li><strong>Project ID</strong> links P.xlsx to other sheets</li>
            <li><strong>Row 1</strong> contains headers for most sheets (except Pipeline which uses Row 11)</li>
            <li>Your budget shows <strong>Infinity%</strong> because Budget Revenue is $0 in AE.xlsx</li>
          </ul>
        </div>
      </div>
      
      {/* Program Management Sheets */}
      {pmSheets.length > 0 && (
        <div style={{
          backgroundColor: '#e0f2fe',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#0277bd', marginBottom: '15px' }}>📊 Program Management Workbook Sheets</h2>
          <p style={{ marginBottom: '20px', color: '#455a64' }}>
            Individual analysis of each sheet within Program_Management.xlsm:
          </p>
          
          {pmSheets.map((sheet, idx) => (
            <div key={idx} style={{
              backgroundColor: 'white',
              padding: '15px',
              marginBottom: '15px',
              borderRadius: '6px',
              border: '1px solid #81d4fa'
            }}>
              <h3 style={{ color: '#0277bd', marginBottom: '10px' }}>📄 {sheet.name}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <strong>Header Row:</strong> {sheet.headerRow}
                  {sheet.headerRow === 11 && <span style={{ color: '#f57c00', marginLeft: '5px' }}>⚠️ Special handling</span>}
                </div>
                <div><strong>Dimensions:</strong> {sheet.totalRows} rows × {sheet.totalColumns} columns</div>
                <div><strong>Headers Available:</strong> {sheet.headers.length > 0 ? '✅ Yes' : '❌ No'}</div>
              </div>
              
              {sheet.headers.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ color: '#00695c', marginBottom: '8px' }}>Headers:</h4>
                  <div style={{
                    backgroundColor: '#f1f8e9',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    maxHeight: '100px',
                    overflowY: 'auto'
                  }}>
                    {sheet.headers.map((header: string, i: number) => (
                      <span key={i} style={{
                        display: 'inline-block',
                        backgroundColor: 'white',
                        padding: '2px 6px',
                        margin: '2px',
                        borderRadius: '3px',
                        border: '1px solid #c8e6c9'
                      }}>
                        {getExcelColumn(i)}: {header}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {sheet.sampleData.length > 0 && (
                <div>
                  <h4 style={{ color: '#d32f2f', marginBottom: '8px' }}>Sample Data:</h4>
                  <div style={{
                    backgroundColor: '#ffebee',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {sheet.sampleData.slice(0, 5).map((row: any[], rowIdx: number) => (
                      <div key={rowIdx} style={{ marginBottom: '8px', borderBottom: '1px solid #ffcdd2', paddingBottom: '5px' }}>
                        <strong>Row {sheet.headerRow + rowIdx + 1}:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '3px' }}>
                          {row.slice(0, 10).map((cell: any, cellIdx: number) => (
                            <span key={cellIdx} style={{
                              backgroundColor: 'white',
                              padding: '1px 4px',
                              borderRadius: '2px',
                              border: '1px solid #ffcdd2',
                              fontSize: '10px'
                            }}>
                              {getExcelColumn(cellIdx)}: {cell === null || cell === undefined ? '<empty>' : String(cell).substring(0, 20)}
                            </span>
                          ))}
                          {row.length > 10 && <span style={{ color: '#9e9e9e' }}>... +{row.length - 10} more columns</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {sheetReports.map((report, idx) => (
        <div key={idx} style={{
          backgroundColor: 'white',
          padding: '20px',
          marginBottom: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 
            color: '#2563eb', 
            borderBottom: '2px solid #e5e7eb', 
            paddingBottom: '10px',
            marginBottom: '15px'
          }}>
            📁 {report.workbook || report.name}
          </h2>
          {report.description && (
            <div style={{ 
              marginBottom: '10px', 
              fontSize: '14px', 
              color: '#6b7280',
              fontStyle: 'italic'
            }}>
              {report.description}
            </div>
          )}
          
          {report.error ? (
            <div style={{ color: 'red' }}>{report.error}</div>
          ) : (
            <>
              <div style={{ marginBottom: '15px' }}>
                <strong>Dimensions:</strong> {report.totalRows} rows × {report.totalColumns} columns
                {editableColumnMappings[report.workbook] && (
                  <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '4px' }}>
                    <strong>Column Mappings Available:</strong>
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                      {Object.entries(editableColumnMappings[report.workbook] as Record<string, string>).map(([col, mapping]) => (
                        <span key={col} style={{
                          display: 'inline-block',
                          margin: '2px',
                          padding: '2px 6px',
                          backgroundColor: '#dbeafe',
                          borderRadius: '3px',
                          border: '1px solid #93c5fd'
                        }}>
                          {col}: {mapping}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#059669', marginBottom: '10px' }}>📊 Headers from Row 1:</h3>
                <div style={{ 
                  backgroundColor: '#f0fdf4', 
                  padding: '10px', 
                  borderRadius: '4px',
                  overflowX: 'auto'
                }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #10b981' }}>
                        <th style={{ padding: '5px', textAlign: 'left' }}>Column</th>
                        <th style={{ padding: '5px', textAlign: 'left' }}>Value</th>
                        <th style={{ padding: '5px', textAlign: 'left' }}>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.headers?.slice(0, 25).map((header: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #d1fae5' }}>
                          <td style={{ padding: '5px' }}>{header.column} (idx {header.index})</td>
                          <td style={{ padding: '5px', fontWeight: header.value !== '<empty>' ? 'bold' : 'normal' }}>
                            {header.value}
                          </td>
                          <td style={{ padding: '5px', color: '#6b7280' }}>{header.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#dc2626', marginBottom: '10px' }}>📝 First Data Rows (Rows 2-4):</h3>
                {report.firstDataRows?.map((row: any) => (
                  <div key={row.rowNumber} style={{
                    backgroundColor: '#fef2f2',
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '4px'
                  }}>
                    <strong>Row {row.rowNumber}:</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '5px', marginTop: '5px' }}>
                      {row.data.slice(0, 20).map((cell: any, i: number) => (
                        <div key={i} style={{ fontSize: '11px', backgroundColor: 'white', padding: '3px', borderRadius: '2px' }}>
                          <strong>{cell.column}:</strong> {cell.value}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {report.columnAnalysis && report.columnAnalysis.length > 0 && (
                <div>
                  <h3 style={{ color: '#7c3aed', marginBottom: '10px' }}>🎯 Column Analysis for Budget Tracker:</h3>
                  <div style={{ backgroundColor: '#faf5ff', padding: '10px', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #a78bfa' }}>
                          <th style={{ padding: '5px', textAlign: 'left' }}>Column</th>
                          <th style={{ padding: '5px', textAlign: 'left' }}>Purpose</th>
                          <th style={{ padding: '5px', textAlign: 'left' }}>Sample Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.columnAnalysis.map((analysis: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e9d5ff' }}>
                            <td style={{ padding: '5px' }}>{analysis.column}</td>
                            <td style={{ padding: '5px', fontWeight: 'bold' }}>{analysis.purpose}</td>
                            <td style={{ padding: '5px', color: '#6b7280' }}>
                              {analysis.sample === null || analysis.sample === undefined ? '<empty>' : String(analysis.sample)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      <div style={{
        backgroundColor: '#fef3c7',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h3 style={{ color: '#92400e', marginBottom: '10px' }}>⚠️ Important Notes:</h3>
        <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
          <li>This report shows what the application is reading from the Excel files</li>
          <li>Row 1 is treated as headers (index 0 in the array)</li>
          <li>Data rows start from Row 2 (index 1 in the array)</li>
          <li>Column letters correspond to Excel columns (A, B, C, etc.)</li>
          <li>Index numbers are 0-based array positions</li>
          <li>For AE sheet: Activity Seq should be in column S (index 18)</li>
          <li>For PT sheet: Activity Seq should be in column E (index 4)</li>
        </ul>
      </div>
    </div>
  );
};

export default DataInspector;