import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ColumnManager from './components/ColumnManager';
import { useColumnManager } from './hooks/useColumnManager';
import { DataSourceMapping, ColumnMapping } from './components/DataSourceMapping';
import { ColumnMappingService } from './services/columnMappingService';

interface BudgetReportRow {
  projectName: string;
  activityDescription: string;
  activitySequence: string;
  // Budget calculations (I6 to T6 equivalent)
  budgetedHours: number;
  actualHours: number;
  remainingHours: number;
  budgetedCost: number;
  actualCost: number;
  remainingCost: number;
  percentComplete: number;
  efficiency: number;
  projectStatus: string;
  variance: number;
  forecastTotal: number;
  performanceIndex: number;
}

interface ProjectBudgetReportProps {
  data?: any;
}

function ProjectBudgetReport({ data }: ProjectBudgetReportProps) {
  const [reportData, setReportData] = useState<BudgetReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [excelCalculations, setExcelCalculations] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof BudgetReportRow>('projectName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showMappings, setShowMappings] = useState(false);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  const defaultColumns = [
    'projectName', 'activityDescription', 'activitySequence', 
    'budgetedHours', 'actualHours', 'remainingHours',
    'budgetedCost', 'actualCost', 'remainingCost',
    'percentComplete', 'efficiency', 'projectStatus',
    'variance', 'forecastTotal', 'performanceIndex'
  ];

  const columnManager = useColumnManager({
    defaultColumns,
    storageKey: 'projectBudgetReport'
  });

  // Initialize default mappings
  useEffect(() => {
    const defaultMappings: ColumnMapping[] = [
      {
        targetColumn: 'projectName',
        sourceColumn: 'Project Name',
        sourceSheet: 'P',
        transformation: 'direct'
      },
      {
        targetColumn: 'activityDescription',
        sourceColumn: 'Activity Description',
        sourceSheet: 'PT',
        transformation: 'direct'
      },
      {
        targetColumn: 'activitySequence',
        sourceColumn: 'Activity Sequence',
        sourceSheet: 'PT',
        transformation: 'direct'
      },
      {
        targetColumn: 'budgetedHours',
        sourceColumn: 'Budgeted Hours',
        sourceSheet: 'PT',
        transformation: 'number'
      },
      {
        targetColumn: 'actualHours',
        sourceColumn: 'Actual Hours',
        sourceSheet: 'PT',
        transformation: 'number'
      }
    ];
    setMappings(defaultMappings);
  }, []);

  // Load Excel calculations from the working sheet
  useEffect(() => {
    const loadExcelCalculations = async () => {
      try {
        setLoading(true);
        const excelData = await invoke('read_excel', {
          filePath: 'C:\\Users\\chris.marinelli\\OneDrive - Vysus Group\\Documents - Energy - Power Engineering\\Program Management\\Project Task Performance_Restored.xlsm'
        });
        
        const workingSheet = excelData.find((sheet: any) => sheet.sheet_name === 'Workingsheet');
        if (workingSheet && workingSheet.data.length > 5) {
          // Extract row 6 (index 5) columns I to T (8 to 19)
          const calculationRow = workingSheet.data[5];
          const calculations = calculationRow?.slice(8, 20) || [];
          
          console.log('Excel calculations found:', calculations);
          setExcelCalculations({
            headers: workingSheet.headers?.slice(8, 20) || [],
            formulas: calculations,
            fullRow: calculationRow
          });
        }
      } catch (error) {
        console.error('Failed to load Excel calculations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExcelCalculations();
  }, []);

  // Process pivot table data into budget report
  useEffect(() => {
    if (data) {
      const projects = extractProjectsFromPivotData(data);
      setReportData(projects);
    }
  }, [data, excelCalculations]);

  const extractProjectsFromPivotData = (pivotData: any): BudgetReportRow[] => {
    const projects: BudgetReportRow[] = [];
    
    try {
      // Look for pivot table data structure
      let projectData = [];
      
      if (pivotData?.data) {
        projectData = pivotData.data;
      } else if (Array.isArray(pivotData)) {
        projectData = pivotData;
      }

      projectData.forEach((row: any[], index: number) => {
        if (row && row.length > 0) {
          const projectName = String(row[0] || `Project ${index + 1}`);
          const activityDescription = String(row[1] || 'General Activity');
          const activitySequence = String(row[2] || `SEQ-${index + 1}`);
          
          // Apply Excel-style calculations
          const budgetedHours = parseFloat(row[3]) || 0;
          const actualHours = parseFloat(row[4]) || 0;
          const hourlyRate = parseFloat(row[5]) || 150; // Default rate
          
          // Budget calculations (replicating Excel formulas)
          const remainingHours = Math.max(0, budgetedHours - actualHours);
          const budgetedCost = budgetedHours * hourlyRate;
          const actualCost = actualHours * hourlyRate;
          const remainingCost = remainingHours * hourlyRate;
          const percentComplete = budgetedHours > 0 ? (actualHours / budgetedHours) * 100 : 0;
          const efficiency = actualHours > 0 ? (budgetedHours / actualHours) * 100 : 100;
          const variance = budgetedCost - actualCost;
          const forecastTotal = actualCost + remainingCost;
          const performanceIndex = budgetedCost > 0 ? actualCost / budgetedCost : 1;
          
          // Determine project status
          let projectStatus = 'On Track';
          if (percentComplete >= 100) projectStatus = 'Complete';
          else if (efficiency < 90) projectStatus = 'Over Budget';
          else if (efficiency > 110) projectStatus = 'Under Budget';
          else if (remainingHours < budgetedHours * 0.1) projectStatus = 'Nearly Complete';
          
          projects.push({
            projectName,
            activityDescription,
            activitySequence,
            budgetedHours: Math.round(budgetedHours * 100) / 100,
            actualHours: Math.round(actualHours * 100) / 100,
            remainingHours: Math.round(remainingHours * 100) / 100,
            budgetedCost: Math.round(budgetedCost * 100) / 100,
            actualCost: Math.round(actualCost * 100) / 100,
            remainingCost: Math.round(remainingCost * 100) / 100,
            percentComplete: Math.round(percentComplete * 100) / 100,
            efficiency: Math.round(efficiency * 100) / 100,
            projectStatus,
            variance: Math.round(variance * 100) / 100,
            forecastTotal: Math.round(forecastTotal * 100) / 100,
            performanceIndex: Math.round(performanceIndex * 1000) / 1000
          });
        }
      });
    } catch (error) {
      console.error('Error processing pivot data:', error);
    }
    
    return projects;
  };

  const projects = [...new Set(reportData.map(row => row.projectName))];
  
  const filteredData = reportData.filter(row => 
    selectedProject === 'all' || row.projectName === selectedProject
  );

  const sortedData = [...filteredData].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    
    if (sortDirection === 'asc') {
      return aStr.localeCompare(bStr);
    } else {
      return bStr.localeCompare(aStr);
    }
  });

  const handleSort = (field: keyof BudgetReportRow) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatHours = (value: number) => {
    return `${value.toFixed(1)}h`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Complete': return '#10b981';
      case 'On Track': return '#3b82f6';
      case 'Over Budget': return '#ef4444';
      case 'Under Budget': return '#8b5cf6';
      case 'Nearly Complete': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getCellRenderer = (column: string, value: any, row: BudgetReportRow) => {
    switch (column) {
      case 'budgetedCost':
      case 'actualCost':
      case 'remainingCost':
      case 'variance':
      case 'forecastTotal':
        return formatCurrency(value);
      case 'budgetedHours':
      case 'actualHours':
      case 'remainingHours':
        return formatHours(value);
      case 'percentComplete':
      case 'efficiency':
        return formatPercentage(value);
      case 'projectStatus':
        return (
          <span style={{ 
            color: getStatusColor(value),
            fontWeight: '600',
            padding: '4px 8px',
            backgroundColor: `${getStatusColor(value)}20`,
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            {value}
          </span>
        );
      case 'performanceIndex':
        return (
          <span style={{ 
            color: value > 1 ? '#ef4444' : value < 0.9 ? '#10b981' : '#6b7280',
            fontWeight: '600'
          }}>
            {value.toFixed(3)}
          </span>
        );
      default:
        return String(value);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
          📊 Project Budget Report
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
          Budget position analysis based on Excel worksheet calculations (I6-T6)
        </p>
        
        {/* Controls */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
          <select 
            value={selectedProject} 
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map(project => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
          
          <button
            onClick={() => setShowMappings(!showMappings)}
            style={{
              padding: '8px 16px',
              backgroundColor: showMappings ? '#059669' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            📊 Edit Mappings
          </button>
          
          <button
            onClick={() => columnManager.setShowColumnManager(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            ⚙️ Manage Columns
          </button>
          
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {filteredData.length} activities | {columnManager.getVisibleColumnCount()}/{columnManager.getColumnCount()} columns
          </div>
        </div>

        {/* Edit Mappings */}
        {showMappings && (
          <DataSourceMapping
            mappings={mappings}
            onMappingsChange={setMappings}
            sourceData={data}
            targetColumns={defaultColumns}
            onClose={() => setShowMappings(false)}
          />
        )}

        {/* Excel Integration Status */}
        {excelCalculations && (
          <div style={{ 
            backgroundColor: '#dbeafe', 
            border: '1px solid #93c5fd',
            borderRadius: '6px', 
            padding: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '14px', color: '#1e40af', fontWeight: '500' }}>
              📋 Excel Integration Active
            </div>
            <div style={{ fontSize: '12px', color: '#3730a3', marginTop: '4px' }}>
              Using calculations from Project Task Performance_Restored.xlsm → Workingsheet → I6:T6
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <div>Loading Excel calculations...</div>
        </div>
      )}

      {/* Budget Report Table */}
      {!loading && (
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ overflowX: 'auto', maxHeight: '70vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ 
                position: 'sticky', 
                top: 0, 
                backgroundColor: '#f8fafc',
                zIndex: 10
              }}>
                <tr>
                  {columnManager.visibleColumns.map((column) => (
                    <th 
                      key={column}
                      onClick={() => handleSort(column as keyof BudgetReportRow)}
                      style={{ 
                        padding: '16px 12px',
                        borderBottom: '2px solid #e5e7eb',
                        borderRight: '1px solid #e5e7eb',
                        backgroundColor: '#f8fafc',
                        textAlign: 'left',
                        fontWeight: '600',
                        fontSize: '13px',
                        color: '#374151',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        userSelect: 'none',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {column.replace(/([A-Z])/g, ' $1').trim()}
                        {sortField === column && (
                          <span style={{ fontSize: '10px', color: '#6b7280' }}>
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedData.length === 0 ? (
                  <tr>
                    <td 
                      colSpan={columnManager.visibleColumns.length}
                      style={{ 
                        padding: '40px', 
                        textAlign: 'center', 
                        color: '#6b7280',
                        fontSize: '16px'
                      }}
                    >
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                      <div style={{ marginBottom: '8px' }}>No Budget Data Available</div>
                      <div style={{ fontSize: '14px' }}>
                        Connect pivot table data to see project budget analysis
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedData.map((row, index) => (
                    <tr 
                      key={`${row.projectName}-${row.activitySequence}-${index}`}
                      style={{ 
                        backgroundColor: index % 2 === 0 ? 'white' : '#f8fafc',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f8fafc'}
                    >
                      {columnManager.visibleColumns.map((column) => (
                        <td 
                          key={column}
                          style={{ 
                            padding: '12px',
                            borderBottom: '1px solid #f1f5f9',
                            borderRight: '1px solid #f1f5f9',
                            fontSize: '13px',
                            color: '#374151'
                          }}
                        >
                          {getCellRenderer(column, row[column as keyof BudgetReportRow], row)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {sortedData.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px',
          marginTop: '24px'
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>
              {formatCurrency(sortedData.reduce((sum, row) => sum + row.budgetedCost, 0))}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Budgeted</div>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
              {formatCurrency(sortedData.reduce((sum, row) => sum + row.actualCost, 0))}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Actual</div>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
              {formatCurrency(sortedData.reduce((sum, row) => sum + row.remainingCost, 0))}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Remaining</div>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
              {formatPercentage(sortedData.reduce((sum, row) => sum + row.percentComplete, 0) / sortedData.length)}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Avg Completion</div>
          </div>
        </div>
      )}

      {/* Excel Formula Reference */}
      {excelCalculations && (
        <div style={{ 
          marginTop: '24px',
          backgroundColor: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '16px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
            📋 Excel Formula Reference (I6:T6)
          </h3>
          <div style={{ 
            fontSize: '12px', 
            fontFamily: 'monospace',
            backgroundColor: '#f8fafc',
            padding: '12px',
            borderRadius: '4px',
            color: '#475569',
            overflowX: 'auto'
          }}>
            <div><strong>Headers:</strong> {excelCalculations.headers?.join(' | ') || 'Loading...'}</div>
            <div style={{ marginTop: '8px' }}><strong>Values:</strong> {excelCalculations.formulas?.join(' | ') || 'Loading...'}</div>
          </div>
        </div>
      )}

      {/* Column Manager */}
      <ColumnManager
        columns={columnManager.allColumns}
        hiddenColumns={columnManager.hiddenColumns}
        customColumns={columnManager.customColumns}
        onToggleColumn={columnManager.toggleColumn}
        onAddColumn={columnManager.addColumn}
        onRemoveColumn={columnManager.removeColumn}
        isVisible={columnManager.showColumnManager}
        onClose={() => columnManager.setShowColumnManager(false)}
      />
    </div>
  );
}

export default ProjectBudgetReport;