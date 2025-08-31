import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

function DebugExcel() {
  const [status, setStatus] = useState('Ready to debug PT.xlsx');
  const [rawData, setRawData] = useState<any>(null);
  const [dataInfo, setDataInfo] = useState<any>(null);

  const handleLoadExcel = async () => {
    try {
      setStatus('Loading PT.xlsx for debugging...');
      const filePath = '/Users/chris/Downloads/PT.xlsx';
      
      const data = await invoke('read_excel', { filePath });
      console.log('Raw data from Rust:', data);
      setRawData(data);
      
      // Analyze the structure
      if (Array.isArray(data) && data.length > 0) {
        const sheet = data[0];
        const info = {
          sheetName: sheet.sheet_name,
          headers: sheet.headers,
          totalRows: sheet.rows?.length || 0,
          firstFiveRows: sheet.rows?.slice(0, 5) || [],
          // Check what's in row 10, 100, 1000 to see if data starts later
          row10: sheet.rows?.[10],
          row100: sheet.rows?.[100],
          row1000: sheet.rows?.[1000],
          row5000: sheet.rows?.[5000],
          // Find first non-empty row
          firstNonEmptyRow: null as any,
          firstNonEmptyIndex: -1
        };
        
        // Find first row with actual data (not just dashes)
        for (let i = 0; i < Math.min(sheet.rows.length, 100); i++) {
          const row = sheet.rows[i];
          if (row && row.some((cell: any) => {
            if (!cell) return false;
            if (cell.Text && cell.Text !== '-' && cell.Text !== '') return true;
            if (cell.Number !== undefined && cell.Number !== 0) return true;
            if (cell.DateTime) return true;
            return false;
          })) {
            info.firstNonEmptyRow = row;
            info.firstNonEmptyIndex = i;
            break;
          }
        }
        
        setDataInfo(info);
        setStatus(`Debug complete: Found ${info.totalRows} rows, first real data at row ${info.firstNonEmptyIndex + 1}`);
      }
    } catch (error: any) {
      console.error('Error:', error);
      setStatus(`Error: ${error?.message || error}`);
    }
  };

  const renderCell = (cell: any) => {
    if (!cell) return 'null';
    if (cell.Text !== undefined) return `Text: "${cell.Text}"`;
    if (cell.Number !== undefined) return `Num: ${cell.Number}`;
    if (cell.DateTime !== undefined) return `Date: ${cell.DateTime}`;
    if (cell.Bool !== undefined) return `Bool: ${cell.Bool}`;
    return JSON.stringify(cell);
  };

  const renderRow = (row: any[], maxCells = 5) => {
    if (!row) return 'No row data';
    return row.slice(0, maxCells).map((cell, i) => (
      <div key={i} style={{ marginLeft: '20px', fontSize: '11px', color: '#666' }}>
        Col {i}: {renderCell(cell)}
      </div>
    ));
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Excel Debug Tool</h1>
      <p>{status}</p>
      
      <button 
        onClick={handleLoadExcel}
        style={{
          padding: '10px 20px',
          backgroundColor: '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        Debug PT.xlsx
      </button>

      {dataInfo && (
        <div style={{ backgroundColor: '#f3f4f6', padding: '20px', borderRadius: '8px' }}>
          <h2>Debug Information:</h2>
          
          <h3>Sheet Info:</h3>
          <p>Sheet Name: {dataInfo.sheetName}</p>
          <p>Total Rows: {dataInfo.totalRows}</p>
          <p>Total Columns: {dataInfo.headers?.length}</p>
          
          <h3>Headers (first 10):</h3>
          <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
            {dataInfo.headers?.slice(0, 10).map((h: string, i: number) => (
              <div key={i}>{i}: {h}</div>
            ))}
          </div>
          
          <h3>First Row (to check if empty):</h3>
          <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
            {renderRow(dataInfo.firstFiveRows[0])}
          </div>
          
          <h3>Row 10:</h3>
          <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
            {renderRow(dataInfo.row10)}
          </div>
          
          <h3>Row 100:</h3>
          <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
            {renderRow(dataInfo.row100)}
          </div>
          
          <h3>Row 1000:</h3>
          <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
            {renderRow(dataInfo.row1000)}
          </div>
          
          <h3>Row 5000:</h3>
          <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
            {renderRow(dataInfo.row5000)}
          </div>
          
          {dataInfo.firstNonEmptyRow && (
            <>
              <h3 style={{ color: '#10b981' }}>First Non-Empty Row (Row {dataInfo.firstNonEmptyIndex + 1}):</h3>
              <div style={{ backgroundColor: '#dcfce7', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
                {renderRow(dataInfo.firstNonEmptyRow, 10)}
              </div>
            </>
          )}
          
          <h3>Raw Data Sample (for debugging):</h3>
          <pre style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', overflow: 'auto', maxHeight: '300px', fontSize: '10px' }}>
            {JSON.stringify(dataInfo.firstFiveRows[0], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default DebugExcel;