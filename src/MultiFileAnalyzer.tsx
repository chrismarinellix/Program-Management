import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface FileData {
  name: string;
  path: string;
  data: any;
  rowCount: number;
  headers: string[];
  loaded: boolean;
  primaryKeys: string[];
  foreignKeys: string[];
}

interface LinkedData {
  projects: Map<string, any>;
  transactions: Map<string, any[]>;
  employees: Map<string, any>;
  relationships: Map<string, Set<string>>;
}

function MultiFileAnalyzer() {
  const [status, setStatus] = useState('Ready to load Excel files');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileData[]>([
    { name: 'Projects', path: '/Users/chris/Downloads/P.xlsx', data: null, rowCount: 0, headers: [], loaded: false, primaryKeys: [], foreignKeys: [] },
    { name: 'Transactions', path: '/Users/chris/Downloads/PT.xlsx', data: null, rowCount: 0, headers: [], loaded: false, primaryKeys: [], foreignKeys: [] },
    { name: 'Employees', path: '/Users/chris/Downloads/AE.xlsx', data: null, rowCount: 0, headers: [], loaded: false, primaryKeys: [], foreignKeys: [] }
  ]);
  const [linkedData, setLinkedData] = useState<LinkedData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'employees' | 'analysis'>('overview');
  const [selectedProject, setSelectedProject] = useState<string>('');

  const loadAllFiles = async () => {
    setLoading(true);
    setStatus('Loading all Excel files...');
    
    try {
      const updatedFiles = await Promise.all(
        files.map(async (file) => {
          try {
            setStatus(`Loading ${file.name}...`);
            const data = await invoke('read_excel', { filePath: file.path });
            const sheet = (data as any[])[0];
            
            // Identify potential keys based on column names
            const headers = sheet.headers || [];
            const primaryKeys = identifyPrimaryKeys(headers, file.name);
            const foreignKeys = identifyForeignKeys(headers, file.name);
            
            return {
              ...file,
              data: sheet,
              rowCount: sheet.rows?.length || 0,
              headers: headers,
              loaded: true,
              primaryKeys,
              foreignKeys
            };
          } catch (error) {
            console.error(`Error loading ${file.name}:`, error);
            return file;
          }
        })
      );
      
      setFiles(updatedFiles);
      
      // Link the data
      const linked = linkDataSets(updatedFiles);
      setLinkedData(linked);
      
      setStatus('All files loaded and linked successfully!');
      setLoading(false);
    } catch (error: any) {
      setStatus(`Error: ${error?.message || error}`);
      setLoading(false);
    }
  };

  const identifyPrimaryKeys = (headers: string[], fileName: string): string[] => {
    const keys: string[] = [];
    
    // Common primary key patterns
    const patterns = ['id', 'code', 'number', 'seq', 'key'];
    
    headers.forEach(header => {
      const lower = header.toLowerCase();
      if (fileName === 'Projects' && (lower.includes('project') && (lower.includes('id') || lower.includes('code') || lower.includes('number')))) {
        keys.push(header);
      } else if (fileName === 'Employees' && (lower.includes('employee') && (lower.includes('id') || lower.includes('number')))) {
        keys.push(header);
      } else if (patterns.some(p => lower.includes(p))) {
        keys.push(header);
      }
    });
    
    return keys;
  };

  const identifyForeignKeys = (headers: string[], fileName: string): string[] => {
    const keys: string[] = [];
    
    headers.forEach(header => {
      const lower = header.toLowerCase();
      // Look for references to other tables
      if (fileName === 'Transactions') {
        if (lower.includes('project') || lower.includes('employee') || lower.includes('customer')) {
          keys.push(header);
        }
      }
    });
    
    return keys;
  };

  const linkDataSets = (fileData: FileData[]): LinkedData => {
    const projects = new Map<string, any>();
    const transactions = new Map<string, any[]>();
    const employees = new Map<string, any>();
    const relationships = new Map<string, Set<string>>();
    
    // Process Projects (P.xlsx)
    const projectFile = fileData.find(f => f.name === 'Projects');
    if (projectFile?.data?.rows) {
      const projectIndex = projectFile.headers.findIndex(h => h.toLowerCase().includes('project'));
      const nameIndex = projectFile.headers.findIndex(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('description'));
      
      projectFile.data.rows.forEach((row: any[]) => {
        const projectId = getCellValue(row[projectIndex]);
        if (projectId) {
          projects.set(projectId, {
            id: projectId,
            name: getCellValue(row[nameIndex]) || projectId,
            data: row,
            transactions: [],
            employees: new Set<string>(),
            totalAmount: 0,
            transactionCount: 0
          });
        }
      });
    }
    
    // Process Employees (AE.xlsx)
    const employeeFile = fileData.find(f => f.name === 'Employees');
    if (employeeFile?.data?.rows) {
      const empIdIndex = employeeFile.headers.findIndex(h => h.toLowerCase().includes('employee'));
      const nameIndex = employeeFile.headers.findIndex(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('description'));
      
      employeeFile.data.rows.forEach((row: any[]) => {
        const empId = getCellValue(row[empIdIndex]);
        if (empId) {
          employees.set(empId, {
            id: empId,
            name: getCellValue(row[nameIndex]) || empId,
            data: row,
            projects: new Set<string>(),
            transactionCount: 0,
            totalAmount: 0
          });
        }
      });
    }
    
    // Process Transactions (PT.xlsx) and link everything
    const transactionFile = fileData.find(f => f.name === 'Transactions');
    if (transactionFile?.data?.rows) {
      const projectIndex = transactionFile.headers.findIndex(h => h === 'Project');
      const employeeIndex = transactionFile.headers.findIndex(h => h === 'Employee');
      const amountIndex = transactionFile.headers.findIndex(h => h.toLowerCase().includes('amount') || h.toLowerCase().includes('price'));
      
      transactionFile.data.rows.forEach((row: any[]) => {
        const projectId = getCellValue(row[projectIndex]);
        const employeeId = getCellValue(row[employeeIndex]);
        const amount = Number(getCellValue(row[amountIndex])) || 0;
        
        // Link transaction to project
        if (projectId) {
          if (!transactions.has(projectId)) {
            transactions.set(projectId, []);
          }
          transactions.get(projectId)!.push(row);
          
          // Update project stats
          const project = projects.get(projectId);
          if (project) {
            project.transactions.push(row);
            project.transactionCount++;
            project.totalAmount += amount;
            if (employeeId) {
              project.employees.add(employeeId);
            }
          }
        }
        
        // Link to employee
        if (employeeId) {
          const employee = employees.get(employeeId);
          if (employee) {
            if (projectId) {
              employee.projects.add(projectId);
            }
            employee.transactionCount++;
            employee.totalAmount += amount;
          }
        }
        
        // Track relationships
        if (projectId && employeeId) {
          const relKey = `${projectId}:${employeeId}`;
          if (!relationships.has(relKey)) {
            relationships.set(relKey, new Set<string>());
          }
          relationships.get(relKey)!.add(`transaction_${row[0]}`);
        }
      });
    }
    
    return { projects, transactions, employees, relationships };
  };

  const getCellValue = (cell: any): string => {
    if (!cell) return '';
    if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
    if (cell.Text !== undefined) return cell.Text;
    if (cell.Number !== undefined) return String(cell.Number);
    if (cell.DateTime !== undefined) return cell.DateTime;
    return String(cell);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTopProjects = () => {
    if (!linkedData) return [];
    return Array.from(linkedData.projects.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
  };

  const getTopEmployees = () => {
    if (!linkedData) return [];
    return Array.from(linkedData.employees.values())
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, 10);
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f1f5f9',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px 0' }}>
          🔗 Multi-File Project Analyzer
        </h1>
        <p style={{ color: '#64748b', fontSize: '16px' }}>{status}</p>
      </div>

      {/* Load Button */}
      {!loading && !linkedData && (
        <button 
          onClick={loadAllFiles}
          style={{
            padding: '14px 40px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.3s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          Load All Excel Files (P, PT, AE)
        </button>
      )}

      {loading && (
        <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'white', borderRadius: '12px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <h3>Loading and Linking Data...</h3>
          <p style={{ color: '#64748b' }}>Processing P.xlsx, PT.xlsx, and AE.xlsx</p>
        </div>
      )}

      {/* File Status Cards */}
      {files.some(f => f.loaded) && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '20px',
          marginBottom: '30px'
        }}>
          {files.map(file => (
            <div key={file.name} style={{ 
              backgroundColor: file.loaded ? '#dcfce7' : '#fee2e2',
              padding: '20px',
              borderRadius: '12px',
              border: `2px solid ${file.loaded ? '#86efac' : '#fca5a5'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#1e293b' }}>{file.name}</h3>
                <span style={{ fontSize: '24px' }}>{file.loaded ? '✅' : '❌'}</span>
              </div>
              {file.loaded && (
                <>
                  <p style={{ margin: '5px 0', color: '#475569' }}>Rows: <strong>{file.rowCount}</strong></p>
                  <p style={{ margin: '5px 0', color: '#475569' }}>Columns: <strong>{file.headers.length}</strong></p>
                  <p style={{ margin: '5px 0', color: '#475569', fontSize: '12px' }}>
                    Keys: {file.primaryKeys.join(', ') || 'Not identified'}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {linkedData && (
        <>
          {/* Navigation Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '10px',
            marginBottom: '30px',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '10px'
          }}>
            {(['overview', 'projects', 'employees', 'analysis'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 24px',
                  backgroundColor: activeTab === tab ? '#3b82f6' : 'transparent',
                  color: activeTab === tab ? 'white' : '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <>
              {/* Summary Stats */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '20px',
                marginBottom: '30px'
              }}>
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Total Projects</div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#3b82f6' }}>{linkedData.projects.size}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Total Employees</div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#8b5cf6' }}>{linkedData.employees.size}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Total Transactions</div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981' }}>
                    {Array.from(linkedData.transactions.values()).reduce((sum, t) => sum + t.length, 0)}
                  </div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Relationships</div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>{linkedData.relationships.size}</div>
                </div>
              </div>

              {/* Data Relationships Diagram */}
              <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', marginBottom: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ marginTop: 0, marginBottom: '20px' }}>📊 Data Relationships</h2>
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      width: '120px', 
                      height: '120px', 
                      backgroundColor: '#dbeafe',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '48px',
                      margin: '0 auto 10px'
                    }}>
                      📁
                    </div>
                    <h3 style={{ margin: '0' }}>Projects</h3>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>P.xlsx</p>
                  </div>
                  
                  <div style={{ fontSize: '36px', color: '#cbd5e1' }}>→</div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      width: '120px', 
                      height: '120px', 
                      backgroundColor: '#dcfce7',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '48px',
                      margin: '0 auto 10px'
                    }}>
                      💰
                    </div>
                    <h3 style={{ margin: '0' }}>Transactions</h3>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>PT.xlsx</p>
                  </div>
                  
                  <div style={{ fontSize: '36px', color: '#cbd5e1' }}>←</div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      width: '120px', 
                      height: '120px', 
                      backgroundColor: '#f3e8ff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '48px',
                      margin: '0 auto 10px'
                    }}>
                      👥
                    </div>
                    <h3 style={{ margin: '0' }}>Employees</h3>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>AE.xlsx</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>📁 Top Projects Analysis</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>Project</th>
                      <th style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>Total Amount</th>
                      <th style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>Transactions</th>
                      <th style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>Team Size</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#64748b' }}>Top Employees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getTopProjects().map(project => (
                      <tr key={project.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', fontWeight: '600' }}>{project.name}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>
                          {formatCurrency(project.totalAmount)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{project.transactionCount}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{project.employees.size}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          {Array.from(project.employees).slice(0, 3).map(empId => {
                            const emp = linkedData.employees.get(empId);
                            return emp?.name || empId;
                          }).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'employees' && (
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>👥 Employee Performance</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {getTopEmployees().map(employee => (
                  <div key={employee.id} style={{ 
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#fafafa'
                  }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>{employee.name}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Projects:</span>
                        <strong style={{ marginLeft: '5px' }}>{employee.projects.size}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Transactions:</span>
                        <strong style={{ marginLeft: '5px' }}>{employee.transactionCount}</strong>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: '#64748b' }}>Total Amount:</span>
                        <strong style={{ marginLeft: '5px', color: '#10b981' }}>{formatCurrency(employee.totalAmount)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>🔍 Cross-File Analysis</h2>
              
              <div style={{ marginBottom: '30px' }}>
                <h3>Project-Employee Matrix</h3>
                <p style={{ color: '#64748b' }}>Showing how many transactions link each project to each employee</p>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '10px',
                  marginTop: '20px'
                }}>
                  {Array.from(linkedData.relationships.entries()).slice(0, 20).map(([key, transactions]) => {
                    const [projectId, employeeId] = key.split(':');
                    const project = linkedData.projects.get(projectId);
                    const employee = linkedData.employees.get(employeeId);
                    
                    return (
                      <div key={key} style={{ 
                        padding: '10px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px'
                      }}>
                        <div style={{ fontWeight: '600', color: '#3b82f6' }}>{project?.name || projectId}</div>
                        <div style={{ color: '#8b5cf6' }}>{employee?.name || employeeId}</div>
                        <div style={{ color: '#64748b', marginTop: '5px' }}>
                          {transactions.size} transactions
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ 
                padding: '20px',
                backgroundColor: '#fef3c7',
                borderRadius: '8px',
                marginTop: '20px'
              }}>
                <h3 style={{ marginTop: 0 }}>📈 Insights</h3>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>Most active project: {getTopProjects()[0]?.name} with {getTopProjects()[0]?.transactionCount} transactions</li>
                  <li>Most active employee: {getTopEmployees()[0]?.name} working on {getTopEmployees()[0]?.projects.size} projects</li>
                  <li>Average team size: {(Array.from(linkedData.projects.values()).reduce((sum, p) => sum + p.employees.size, 0) / linkedData.projects.size).toFixed(1)} employees per project</li>
                  <li>Total linked relationships: {linkedData.relationships.size} unique project-employee pairs</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MultiFileAnalyzer;