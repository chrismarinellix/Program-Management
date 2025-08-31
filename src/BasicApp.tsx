import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

function BasicApp() {
  const [status, setStatus] = useState('Click Load Excel to load your stock data');
  const [excelData, setExcelData] = useState<any>(null);

  const handleLoadExcel = async () => {
    try {
      setStatus('Loading PT.xlsx file...');
      // Updated to use PT.xlsx from Downloads
      const filePath = '/Users/chris/Downloads/PT.xlsx';
      
      // Call the Rust backend to read Excel
      const data = await invoke('read_excel', { filePath });
      setExcelData(data);
      setStatus(`Excel loaded successfully! Found ${(data as any[]).length} sheets`);
      console.log('Excel data:', data);
      
      // Automatically detect and analyze the data structure
      analyzeData(data);
    } catch (error) {
      console.error('Error loading Excel:', error);
      setStatus(`Error: ${error}`);
    }
  };

  const analyzeData = (data: any) => {
    // The code automatically detects:
    // 1. Date/time columns for time series
    // 2. Numeric columns for prices, volumes, percentages
    // 3. Text columns for symbols, names, descriptions
    // This happens in the services/excel.service.ts file
    
    if (Array.isArray(data) && data.length > 0) {
      const firstSheet = data[0];
      console.log('Analyzing sheet:', firstSheet.sheet_name);
      console.log('Headers found:', firstSheet.headers);
      
      // The existing code in services/excel.service.ts will:
      // - Detect 'Date' columns and parse them
      // - Find 'Open', 'High', 'Low', 'Close', 'Volume' for candlestick charts
      // - Calculate technical indicators (SMA, EMA, RSI, MACD) automatically
      // - Identify trends and patterns
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: 'blue' }}>Stock Visualizer</h1>
      <p>Status: {status}</p>
      
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={handleLoadExcel}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Load Excel
        </button>
        
        <button 
          onClick={() => {
            alert('Connect to IB clicked!');
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Connect to IB
        </button>
      </div>
      
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
        <h2>Instructions:</h2>
        <ol>
          <li>Click "Load Excel" to load your stock data</li>
          <li>Click "Connect to IB" to connect to Interactive Brokers</li>
          <li>Use the tabs to navigate between Charts, Data, Trading, and Backtest</li>
        </ol>
      </div>
      
      {excelData && (
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#e0f2fe', borderRadius: '8px' }}>
          <h2>Excel Data Loaded:</h2>
          <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '300px' }}>
            {JSON.stringify(excelData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default BasicApp;