import React from 'react';
import { dataSourceMappings, columnMappings } from '../config/dataSourceMapping';

const DataSourceTable: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '20px', color: '#1f2937' }}>Data Source Mapping</h3>
      
      {/* Main mapping table */}
      <div style={{ marginBottom: '40px' }}>
        <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '16px' }}>
          Dashboard Views & Their Data Sources
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{ 
                backgroundColor: '#f9fafb', 
                borderBottom: '2px solid #e5e7eb' 
              }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>View</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Source File(s)</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Sheet Name</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Header Row</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {dataSourceMappings.map((mapping, idx) => (
                <tr key={idx} style={{ 
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb'
                }}>
                  <td style={{ padding: '12px', fontWeight: '500' }}>
                    <div>{mapping.displayName}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {mapping.description}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {mapping.sourceFiles.map((file, i) => (
                      <div key={i} style={{ 
                        display: 'inline-block',
                        padding: '2px 8px',
                        margin: '2px',
                        backgroundColor: '#eef2ff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#4f46e5'
                      }}>
                        {file}
                      </div>
                    ))}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {mapping.sourceSheets.map((sheet, i) => (
                      <div key={i} style={{ 
                        display: 'inline-block',
                        padding: '2px 8px',
                        margin: '2px',
                        backgroundColor: '#f0fdf4',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#16a34a'
                      }}>
                        {sheet}
                      </div>
                    ))}
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    textAlign: 'center',
                    fontWeight: '600'
                  }}>
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: mapping.headerRow === 1 ? '#dcfce7' : '#fef3c7',
                      borderRadius: '4px',
                      color: mapping.headerRow === 1 ? '#16a34a' : '#d97706'
                    }}>
                      {mapping.headerRow}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>
                    {mapping.notes && (
                      <div style={{
                        padding: '4px 8px',
                        backgroundColor: '#fef3c7',
                        borderRadius: '4px',
                        color: '#92400e'
                      }}>
                        {mapping.notes}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column mappings */}
      <div>
        <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '16px' }}>
          Excel Column Mappings
        </h4>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {Object.entries(columnMappings).map(([file, columns]) => (
            <div key={file} style={{
              padding: '16px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <h5 style={{ 
                marginBottom: '12px', 
                color: '#1f2937',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                📄 {file}
              </h5>
              <div style={{ fontSize: '13px' }}>
                {Object.entries(columns).map(([col, desc]) => (
                  <div key={col} style={{ 
                    display: 'flex',
                    marginBottom: '6px',
                    padding: '4px 0'
                  }}>
                    <span style={{ 
                      fontWeight: '600',
                      color: '#4f46e5',
                      minWidth: '40px'
                    }}>
                      {col}:
                    </span>
                    <span style={{ 
                      marginLeft: '8px',
                      color: '#374151'
                    }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key information */}
      <div style={{
        marginTop: '30px',
        padding: '16px',
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        border: '1px solid #fde68a'
      }}>
        <h5 style={{ marginBottom: '8px', color: '#92400e' }}>
          ⚠️ Important Notes:
        </h5>
        <ul style={{ 
          margin: 0, 
          paddingLeft: '20px',
          fontSize: '13px',
          color: '#78350f'
        }}>
          <li>Pipeline data headers are in row 11, not row 1</li>
          <li>Program Management headers are in row 3</li>
          <li>Activity Seq is the key field linking PT and AE data</li>
          <li>Column AH contains revenue (not AI as sometimes documented)</li>
          <li>All data is cached in SQLite for performance</li>
        </ul>
      </div>
    </div>
  );
};

export default DataSourceTable;