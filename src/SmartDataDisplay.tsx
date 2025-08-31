import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface DataSummary {
  sheetName: string;
  rowCount: number;
  columnCount: number;
  dateColumns: string[];
  numericColumns: string[];
  textColumns: string[];
  keyMetrics: any;
}

function SmartDataDisplay() {
  const [status, setStatus] = useState('Ready to load PT.xlsx');
  const [excelData, setExcelData] = useState<any>(null);
  const [dataSummary, setDataSummary] = useState<DataSummary[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);

  const handleLoadExcel = async () => {
    try {
      console.log('Button clicked - starting load');
      setStatus('Loading PT.xlsx...');
      const filePath = '/Users/chris/Downloads/PT.xlsx';
      console.log('File path:', filePath);
      
      // Add visual feedback
      document.body.style.cursor = 'wait';
      
      console.log('Calling Rust backend...');
      const data = await invoke('read_excel', { filePath });
      console.log('Data received from Rust:', data);
      
      setExcelData(data);
      
      // Analyze each sheet
      const summaries = analyzeAllSheets(data as any[]);
      setDataSummary(summaries);
      
      setStatus(`Loaded ${(data as any[]).length} sheets successfully!`);
      document.body.style.cursor = 'default';
    } catch (error: any) {
      console.error('Error loading Excel:', error);
      setStatus(`Error: ${error?.message || error?.toString() || 'Unknown error'}`);
      document.body.style.cursor = 'default';
      
      // Show detailed error
      alert(`Failed to load Excel:\n${error?.message || error}`);
    }
  };

  const analyzeAllSheets = (data: any[]): DataSummary[] => {
    return data.map(sheet => {
      const summary: DataSummary = {
        sheetName: sheet.sheet_name || 'Unnamed Sheet',
        rowCount: sheet.rows ? sheet.rows.length : 0,
        columnCount: sheet.headers ? sheet.headers.length : 0,
        dateColumns: [],
        numericColumns: [],
        textColumns: [],
        keyMetrics: {}
      };

      if (sheet.headers && sheet.rows && sheet.rows.length > 0) {
        // Analyze column types
        sheet.headers.forEach((header: string, index: number) => {
          const firstRow = sheet.rows[0][index];
          
          // Check if it's a date column
          if (header.toLowerCase().includes('date') || header.toLowerCase().includes('time')) {
            summary.dateColumns.push(header);
          }
          // Check if it's numeric
          else if (firstRow && (firstRow.Number !== undefined || 
                   header.toLowerCase().match(/(price|close|open|high|low|volume|change|return|percent|value|amount)/))) {
            summary.numericColumns.push(header);
            
            // Calculate key metrics for numeric columns
            const values = sheet.rows.map((row: any) => row[index]?.Number || 0).filter((v: number) => !isNaN(v));
            if (values.length > 0) {
              summary.keyMetrics[header] = {
                min: Math.min(...values),
                max: Math.max(...values),
                avg: values.reduce((a: number, b: number) => a + b, 0) / values.length,
                latest: values[values.length - 1]
              };
            }
          }
          // Otherwise it's text
          else {
            summary.textColumns.push(header);
          }
        });
      }

      return summary;
    });
  };

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (Math.abs(num) >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const renderDataTable = (sheet: any) => {
    if (!sheet || !sheet.rows || sheet.rows.length === 0) return null;

    // Show first 10 rows
    const displayRows = sheet.rows.slice(0, 10);

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6' }}>
            {sheet.headers.map((header: string, i: number) => (
              <th key={i} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #d1d5db' }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row: any[], rowIndex: number) => (
            <tr key={rowIndex} style={{ borderBottom: '1px solid #e5e7eb' }}>
              {row.map((cell: any, cellIndex: number) => (
                <td key={cellIndex} style={{ padding: '8px' }}>
                  {cell?.Text || cell?.Number?.toFixed(2) || cell?.DateTime || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ color: '#1e40af', marginBottom: '10px' }}>Stock Data Analyzer</h1>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>{status}</p>
      
      <button 
        onClick={handleLoadExcel}
        style={{
          padding: '12px 24px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: '500'
        }}
      >
        Load PT.xlsx
      </button>

      {dataSummary.length > 0 && (
        <>
          {/* Sheet Tabs */}
          <div style={{ marginTop: '30px', borderBottom: '2px solid #e5e7eb' }}>
            {dataSummary.map((summary, index) => (
              <button
                key={index}
                onClick={() => setSelectedSheet(index)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: selectedSheet === index ? '#3b82f6' : 'transparent',
                  color: selectedSheet === index ? 'white' : '#4b5563',
                  border: 'none',
                  borderRadius: '6px 6px 0 0',
                  cursor: 'pointer',
                  marginRight: '5px',
                  fontWeight: selectedSheet === index ? '600' : '400'
                }}
              >
                {summary.sheetName}
              </button>
            ))}
          </div>

          {/* Summary Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '20px',
            marginTop: '20px' 
          }}>
            {/* Data Overview Card */}
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#f0f9ff', 
              borderRadius: '8px',
              border: '1px solid #bfdbfe'
            }}>
              <h3 style={{ color: '#1e40af', marginBottom: '10px' }}>📊 Data Overview</h3>
              <p>Rows: <strong>{dataSummary[selectedSheet].rowCount}</strong></p>
              <p>Columns: <strong>{dataSummary[selectedSheet].columnCount}</strong></p>
              <p>Date columns: <strong>{dataSummary[selectedSheet].dateColumns.length}</strong></p>
              <p>Numeric columns: <strong>{dataSummary[selectedSheet].numericColumns.length}</strong></p>
            </div>

            {/* Key Metrics Cards */}
            {Object.entries(dataSummary[selectedSheet].keyMetrics).slice(0, 3).map(([column, metrics]: [string, any]) => (
              <div key={column} style={{ 
                padding: '20px', 
                backgroundColor: '#f0fdf4', 
                borderRadius: '8px',
                border: '1px solid #bbf7d0'
              }}>
                <h3 style={{ color: '#166534', marginBottom: '10px' }}>📈 {column}</h3>
                <p>Latest: <strong>{formatNumber(metrics.latest)}</strong></p>
                <p>Average: <strong>{formatNumber(metrics.avg)}</strong></p>
                <p>Range: <strong>{formatNumber(metrics.min)} - {formatNumber(metrics.max)}</strong></p>
                {metrics.latest > metrics.avg && 
                  <p style={{ color: '#16a34a' }}>↑ Above average</p>
                }
                {metrics.latest < metrics.avg && 
                  <p style={{ color: '#dc2626' }}>↓ Below average</p>
                }
              </div>
            ))}
          </div>

          {/* Data Table */}
          {excelData && (
            <div style={{ marginTop: '30px' }}>
              <h3 style={{ marginBottom: '10px' }}>📋 Data Preview (First 10 rows)</h3>
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                {renderDataTable(excelData[selectedSheet])}
              </div>
            </div>
          )}

          {/* Column Analysis */}
          <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
            <h3 style={{ color: '#92400e', marginBottom: '10px' }}>🔍 Detected Columns</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div>
                <h4 style={{ color: '#b45309' }}>Date/Time:</h4>
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  {dataSummary[selectedSheet].dateColumns.map(col => (
                    <li key={col}>{col}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ color: '#b45309' }}>Numeric:</h4>
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  {dataSummary[selectedSheet].numericColumns.map(col => (
                    <li key={col}>{col}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ color: '#b45309' }}>Text:</h4>
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  {dataSummary[selectedSheet].textColumns.map(col => (
                    <li key={col}>{col}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SmartDataDisplay;