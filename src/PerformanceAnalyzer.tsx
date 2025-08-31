import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

function PerformanceAnalyzer() {
  const [status, setStatus] = useState('Ready to analyze Performance workbook');
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [row6Data, setRow6Data] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  const loadPerformanceFile = async () => {
    try {
      setStatus('Loading Project Task Performance workbook...');
      const filePath = '/Users/chris/Downloads/Project Task Performance_Restored.xlsm';
      
      const data = await invoke('read_excel', { filePath });
      console.log('Performance file data:', data);
      
      if (Array.isArray(data) && data.length > 0) {
        const sheet = data[0]; // First sheet
        setPerformanceData(sheet);
        
        // Get headers
        if (sheet.headers) {
          setHeaders(sheet.headers);
          console.log('Headers:', sheet.headers);
        }
        
        // Get row 6 (index 5 in 0-based array)
        if (sheet.rows && sheet.rows.length > 5) {
          const row6 = sheet.rows[5]; // Row 6 in Excel = index 5
          setRow6Data(row6);
          console.log('Row 6 data:', row6);
          
          // Log each cell in row 6 with its corresponding header
          sheet.headers.forEach((header: string, index: number) => {
            const cellValue = getCellValue(row6[index]);
            if (cellValue) {
              console.log(`Column ${header}: ${cellValue}`);
            }
          });
        }
        
        setStatus('Performance file loaded! Check console for row 6 calculations.');
      }
    } catch (error: any) {
      console.error('Error loading performance file:', error);
      setStatus(`Error: ${error?.message || error}`);
    }
  };

  const getCellValue = (cell: any): string => {
    if (!cell) return '';
    if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
    if (cell.Text !== undefined) return cell.Text;
    if (cell.Number !== undefined) return String(cell.Number);
    if (cell.DateTime !== undefined) return cell.DateTime;
    if (cell.Formula !== undefined) return `Formula: ${cell.Formula}`;
    return JSON.stringify(cell);
  };

  // Identify calculation columns based on typical performance metrics
  const identifyCalculations = () => {
    const calculations: any[] = [];
    
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase();
      
      // Common calculation columns
      if (
        headerLower.includes('total') ||
        headerLower.includes('sum') ||
        headerLower.includes('avg') ||
        headerLower.includes('average') ||
        headerLower.includes('margin') ||
        headerLower.includes('profit') ||
        headerLower.includes('cost') ||
        headerLower.includes('budget') ||
        headerLower.includes('variance') ||
        headerLower.includes('efficiency') ||
        headerLower.includes('utilization') ||
        headerLower.includes('performance') ||
        headerLower.includes('rate') ||
        headerLower.includes('percentage') ||
        headerLower.includes('%')
      ) {
        const value = row6Data[index];
        if (value) {
          calculations.push({
            header: header,
            index: index,
            value: getCellValue(value),
            type: identifyCalculationType(header)
          });
        }
      }
    });
    
    return calculations;
  };

  const identifyCalculationType = (header: string): string => {
    const headerLower = header.toLowerCase();
    if (headerLower.includes('margin')) return 'margin';
    if (headerLower.includes('budget')) return 'budget';
    if (headerLower.includes('variance')) return 'variance';
    if (headerLower.includes('efficiency')) return 'efficiency';
    if (headerLower.includes('utilization')) return 'utilization';
    if (headerLower.includes('cost')) return 'cost';
    if (headerLower.includes('profit')) return 'profit';
    if (headerLower.includes('rate')) return 'rate';
    if (headerLower.includes('%') || headerLower.includes('percentage')) return 'percentage';
    return 'other';
  };

  const calculations = row6Data.length > 0 ? identifyCalculations() : [];

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>📊 Performance Workbook Analyzer</h1>
      <p>{status}</p>
      
      <button 
        onClick={loadPerformanceFile}
        style={{
          padding: '10px 20px',
          backgroundColor: '#8b5cf6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        Load Performance Workbook
      </button>

      {performanceData && (
        <div style={{ backgroundColor: '#f3f4f6', padding: '20px', borderRadius: '8px' }}>
          <h2>Workbook Info:</h2>
          <p>Sheet Name: {performanceData.sheet_name}</p>
          <p>Total Rows: {performanceData.rows?.length || 0}</p>
          <p>Total Columns: {headers.length}</p>
          
          <h2 style={{ marginTop: '30px' }}>Row 6 Data (Calculations Row):</h2>
          
          {/* Display first 10 columns of row 6 */}
          <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
            <h3>First 10 Columns:</h3>
            {headers.slice(0, 10).map((header, index) => (
              <div key={index} style={{ marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>
                <strong>{header}:</strong>
                <div style={{ marginLeft: '20px', color: '#4b5563' }}>
                  {getCellValue(row6Data[index]) || 'empty'}
                </div>
              </div>
            ))}
          </div>

          {/* Display identified calculations */}
          {calculations.length > 0 && (
            <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '6px' }}>
              <h3>Identified Calculations in Row 6:</h3>
              {calculations.map((calc, index) => (
                <div key={index} style={{ 
                  marginBottom: '15px', 
                  padding: '10px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{calc.header}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>Type: {calc.type}</div>
                  <div style={{ color: '#3b82f6', marginTop: '5px' }}>{calc.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Display all headers for reference */}
          <details style={{ marginTop: '30px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Show All Column Headers</summary>
            <div style={{ 
              backgroundColor: 'white', 
              padding: '15px', 
              borderRadius: '6px',
              marginTop: '10px',
              maxHeight: '300px',
              overflow: 'auto'
            }}>
              {headers.map((header, index) => (
                <div key={index} style={{ padding: '3px' }}>
                  {index}: {header}
                </div>
              ))}
            </div>
          </details>

          {/* Raw row 6 data */}
          <details style={{ marginTop: '20px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Show Raw Row 6 Data</summary>
            <pre style={{ 
              backgroundColor: 'white', 
              padding: '15px', 
              borderRadius: '6px',
              overflow: 'auto',
              fontSize: '11px',
              marginTop: '10px'
            }}>
              {JSON.stringify(row6Data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default PerformanceAnalyzer;