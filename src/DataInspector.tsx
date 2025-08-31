import React, { useEffect, useState } from 'react';

interface DataInspectorProps {
  data: any;
}

const DataInspector: React.FC<DataInspectorProps> = ({ data }) => {
  const [sheetReports, setSheetReports] = useState<any[]>([]);

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
      { key: 'ae', workbook: 'AE.xlsx', description: 'Activities Estimates (Budget)' },
      { key: 'program', workbook: 'Program_Management.xlsm', description: 'Program Management' }
    ];
    
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
            { column: 'F (index 5)', purpose: 'Activity Seq', sample: sheetData.rows[1]?.[5] },
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

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ marginBottom: '20px', color: '#1f2937' }}>📋 Data Inspector - Sheet Analysis Report</h1>
      
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
          <li>For PT sheet: Activity Seq should be in column F (index 5)</li>
        </ul>
      </div>
    </div>
  );
};

export default DataInspector;