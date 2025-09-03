import React, { useEffect, useState } from 'react';
import { savePivotCache, loadPivotCache, getLastPivotRefresh } from './services/database';
import { ColumnHeader, DataSourceMapping, ColumnMapping } from './components/DataSourceMapping';
import ColumnManager from './components/ColumnManager';
import { useColumnManager } from './hooks/useColumnManager';
import { ColumnMappingService } from './services/columnMappingService';

interface PivotTablesProps {
  data: any;
}

interface PivotRow {
  activitySeq: string;
  projectId?: string;
  projectDescription?: string;
  activityDescription?: string;
  totalHours: number;
  totalCost: number;
  totalRevenue: number;
  transactionCount: number;
}

interface BudgetPivotRow {
  activitySeq: string;
  projectId: string;
  projectName: string;
  activityDescription: string;
  budgetHours: number;
  budgetCost: number;
  budgetRevenue: number;
  actualHours: number;
  actualCost: number;
  actualRevenue: number;
  variance: number;
  usagePercent: number;
}

const PivotTables: React.FC<PivotTablesProps> = ({ data }) => {
  const [ptPivot, setPtPivot] = useState<PivotRow[]>([]);
  const [budgetPivot, setBudgetPivot] = useState<BudgetPivotRow[]>([]);
  const [projectPivot, setProjectPivot] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [showMappingEditor, setShowMappingEditor] = useState<string | null>(null);
  
  // Column management for each pivot table
  const ptColumnManager = useColumnManager({
    defaultColumns: ['activitySeq', 'projectId', 'activityDescription', 'totalHours', 'totalCost', 'totalRevenue', 'transactionCount'],
    storageKey: 'pivotTables_pt'
  });
  
  const budgetColumnManager = useColumnManager({
    defaultColumns: ['activitySeq', 'projectId', 'projectName', 'activityDescription', 'budgetHours', 'budgetCost', 'budgetRevenue', 'actualHours', 'actualCost', 'actualRevenue', 'variance', 'usagePercent'],
    storageKey: 'pivotTables_budget'
  });
  
  const projectColumnManager = useColumnManager({
    defaultColumns: ['projectName', 'client', 'budget', 'spent', 'remaining', 'status', 'activities', 'team'],
    storageKey: 'pivotTables_project'
  });
  
  // Define separate column mappings for each pivot table
  const [ptTransactionMappings, setPtTransactionMappings] = useState<{ [key: string]: ColumnMapping }>({
    activitySeq: { displayName: 'Activity Seq', source: 'PT', column: 'E', editable: true },
    project: { displayName: 'Project', source: 'PT', column: 'H', editable: true },
    activity: { displayName: 'Activity', source: 'PT', column: 'L', editable: true },
    hours: { displayName: 'Hours', source: 'PT', column: 'S', editable: true },
    cost: { displayName: 'Cost', source: 'PT', column: 'Y', editable: true },
    revenue: { displayName: 'Revenue', source: 'PT', column: 'AH', editable: true },
  });

  const [budgetActualMappings, setBudgetActualMappings] = useState<{ [key: string]: ColumnMapping }>({
    activitySeq: { displayName: 'Activity Seq', source: 'AE', column: 'S', editable: true },
    project: { displayName: 'Project', source: 'AE', column: 'C', editable: true },
    activity: { displayName: 'Activity', source: 'AE', column: 'G', editable: true },
    budgetRev: { displayName: 'Budget Rev', source: 'AE', column: 'L', editable: true },
    actualRev: { displayName: 'Actual Rev', source: 'PT', column: 'AH', editable: true },
  });

  const [projectSummaryMappings, setProjectSummaryMappings] = useState<{ [key: string]: ColumnMapping }>({
    projectId: { displayName: 'Project ID', source: 'PT', column: 'A', editable: true },
    projectName: { displayName: 'Project Name', source: 'PT', column: 'H', editable: true },
    hours: { displayName: 'Hours', source: 'PT', column: 'S', editable: true },
    cost: { displayName: 'Cost', source: 'PT', column: 'Y', editable: true },
    revenue: { displayName: 'Revenue', source: 'PT', column: 'AH', editable: true },
  });

  // Helper function to convert column letter to array index
  const columnToIndex = (column: string): number => {
    const letters = column.toUpperCase();
    let index = 0;
    for (let i = 0; i < letters.length; i++) {
      index = index * 26 + (letters.charCodeAt(i) - 65) + 1;
    }
    return index - 1; // Convert to 0-based index
  };

  // Handle mapping changes for different tables
  const handleMappingChange = (key: string, newMapping: ColumnMapping) => {
    if (showMappingEditor === 'pt-transactions') {
      setPtTransactionMappings(prev => ({
        ...prev,
        [key]: newMapping
      }));
    } else if (showMappingEditor === 'budget-actual') {
      setBudgetActualMappings(prev => ({
        ...prev,
        [key]: newMapping
      }));
    } else if (showMappingEditor === 'project-summary') {
      setProjectSummaryMappings(prev => ({
        ...prev,
        [key]: newMapping
      }));
    }
    // Force data reprocessing with new mappings
    if (data) {
      processPivotData();
    }
  };

  // Handle saving all mappings
  const handleSaveAllMappings = (allMappings: { [key: string]: ColumnMapping }) => {
    const columnMappings = ColumnMappingService.getColumnMappings();
    
    const mappingKey = showMappingEditor === 'pt-transactions' ? 'PivotPT' :
                      showMappingEditor === 'budget-actual' ? 'PivotBudget' :
                      'PivotProject';
    
    const updatedMappings = {
      ...columnMappings,
      [`${mappingKey}_Mappings`]: Object.fromEntries(
        Object.entries(allMappings).map(([key, mapping]) => [
          mapping.column,
          `${mapping.displayName} (${mapping.source})`
        ])
      )
    };
    
    const success = ColumnMappingService.saveColumnMappings(updatedMappings);
    
    if (success) {
      if (showMappingEditor === 'pt-transactions') {
        setPtTransactionMappings(allMappings);
      } else if (showMappingEditor === 'budget-actual') {
        setBudgetActualMappings(allMappings);
      } else if (showMappingEditor === 'project-summary') {
        setProjectSummaryMappings(allMappings);
      }
      
      // Reprocess data with new mappings
      if (data) {
        processPivotData();
      }
    }
    
    return success;
  };

  // Load cached data on component mount
  useEffect(() => {
    loadCachedData();
  }, []);

  const loadCachedData = async () => {
    try {
      const [cachedPt, cachedBudget, cachedProject, lastRef] = await Promise.all([
        loadPivotCache('pt_pivot'),
        loadPivotCache('budget_pivot'),
        loadPivotCache('project_pivot'),
        getLastPivotRefresh('pt_pivot')
      ]);
      
      if (cachedPt && cachedPt.length > 0) {
        console.log('Loaded PT pivot from cache:', cachedPt.length, 'rows');
        setPtPivot(cachedPt);
        setIsFromCache(true);
      }
      if (cachedBudget && cachedBudget.length > 0) {
        console.log('Loaded Budget pivot from cache:', cachedBudget.length, 'rows');
        setBudgetPivot(cachedBudget);
      }
      if (cachedProject && cachedProject.length > 0) {
        console.log('Loaded Project pivot from cache:', cachedProject.length, 'rows');
        setProjectPivot(cachedProject);
      }
      
      if (lastRef) {
        setLastRefresh(lastRef);
      }
    } catch (error) {
      console.error('Failed to load cached pivots:', error);
    }
  };

  useEffect(() => {
    if (!data) {
      // If no new data, keep using cached data
      return;
    }

    console.log('PivotTables processing fresh data:', {
      hasData: !!data,
      ptRows: data?.pt?.rows?.length || 0,
      aeRows: data?.ae?.rows?.length || 0,
    });

    // Process fresh data and save to cache
    processPivotData();
  }, [data]);

  const processPivotData = async () => {
    if (!data) return;

    // Generate PT Pivot Table (Aggregates transactions by Activity Seq)
    if (data.pt?.rows) {
      const pivotMap = new Map<string, PivotRow>();
      
      // Get column indices from PT transaction mappings
      const activitySeqIdx = columnToIndex(ptTransactionMappings.activitySeq.column);
      const projectDescIdx = columnToIndex(ptTransactionMappings.project.column);
      const activityDescIdx = columnToIndex(ptTransactionMappings.activity.column);
      const hoursIdx = columnToIndex(ptTransactionMappings.hours.column);
      const costIdx = columnToIndex(ptTransactionMappings.cost.column);
      const revenueIdx = columnToIndex(ptTransactionMappings.revenue.column);
      const projectIdIdx = 0; // Column A - Project ID (not shown in table but used internally)
      
      // Skip header row (index 0)
      for (let i = 1; i < data.pt.rows.length; i++) {
        const row = data.pt.rows[i];
        const activitySeq = row[activitySeqIdx];
        
        if (!activitySeq || activitySeq === 0) continue;
        
        const key = String(activitySeq);
        const existing = pivotMap.get(key) || {
          activitySeq: key,
          projectId: row[projectIdIdx] || '',
          projectDescription: row[projectDescIdx] || '',
          activityDescription: row[activityDescIdx] || '',
          totalHours: 0,
          totalCost: 0,
          totalRevenue: 0,
          transactionCount: 0
        };
        
        // Update descriptions if not already set
        if (!existing.projectDescription && row[projectDescIdx]) {
          existing.projectDescription = row[projectDescIdx];
        }
        if (!existing.activityDescription && row[activityDescIdx]) {
          existing.activityDescription = row[activityDescIdx];
        }
        
        existing.totalHours += parseFloat(row[hoursIdx]) || 0;
        existing.totalCost += parseFloat(row[costIdx]) || 0;
        existing.totalRevenue += parseFloat(row[revenueIdx]) || 0;
        existing.transactionCount += 1;
        
        pivotMap.set(key, existing);
      }
      
      const ptPivotData = Array.from(pivotMap.values()).sort((a, b) => 
        a.activitySeq.localeCompare(b.activitySeq)
      );
      
      setPtPivot(ptPivotData);
      setIsFromCache(false);
      
      // Save to cache
      try {
        await savePivotCache('pt_pivot', ptPivotData, ['PT.xlsx']);
        console.log('Saved PT pivot to cache');
      } catch (error) {
        console.error('Failed to save PT pivot to cache:', error);
      }
    }

    // Generate Budget vs Actual Pivot (Joins AE and PT data)
    if (data.ae?.rows && data.pt?.rows) {
      // Get column indices for PT data (for actuals)
      const ptActivitySeqIdx = columnToIndex(ptTransactionMappings.activitySeq.column);
      const ptHoursIdx = columnToIndex(ptTransactionMappings.hours.column);
      const ptCostIdx = columnToIndex(ptTransactionMappings.cost.column);
      const ptRevenueIdx = columnToIndex(budgetActualMappings.actualRev.column);
      
      // Get column indices for AE data (for budget)
      const aeActivitySeqIdx = columnToIndex(budgetActualMappings.activitySeq.column);
      const aeProjectNameIdx = columnToIndex(budgetActualMappings.project.column);
      const aeActivityDescIdx = columnToIndex(budgetActualMappings.activity.column);
      const aeBudgetRevenueIdx = columnToIndex(budgetActualMappings.budgetRev.column);
      const aeProjectIdIdx = 1; // Column B in AE
      const aeBudgetHoursIdx = 12; // Column M in AE
      const aeBudgetCostIdx = 10; // Column K in AE
      
      // First create PT aggregation map
      const ptMap = new Map<string, any>();
      for (let i = 1; i < data.pt.rows.length; i++) {
        const row = data.pt.rows[i];
        const activitySeq = String(row[ptActivitySeqIdx]);
        
        if (!activitySeq || activitySeq === '0') continue;
        
        const existing = ptMap.get(activitySeq) || {
          actualHours: 0,
          actualCost: 0,
          actualRevenue: 0
        };
        
        existing.actualHours += parseFloat(row[ptHoursIdx]) || 0;
        existing.actualCost += parseFloat(row[ptCostIdx]) || 0;
        existing.actualRevenue += parseFloat(row[ptRevenueIdx]) || 0;
        
        ptMap.set(activitySeq, existing);
      }
      
      // Now join with AE data
      const budgetData: BudgetPivotRow[] = [];
      for (let i = 1; i < data.ae.rows.length; i++) {
        const row = data.ae.rows[i];
        const activitySeq = String(row[aeActivitySeqIdx]);
        
        if (!activitySeq || activitySeq === '0') continue;
        
        const ptData = ptMap.get(activitySeq) || {
          actualHours: 0,
          actualCost: 0,
          actualRevenue: 0
        };
        
        const budgetRevenue = parseFloat(row[aeBudgetRevenueIdx]) || 0;
        const actualRevenue = ptData.actualRevenue;
        
        budgetData.push({
          activitySeq,
          projectId: row[aeProjectIdIdx] || '',
          projectName: row[aeProjectNameIdx] || '',
          activityDescription: row[aeActivityDescIdx] || '',
          budgetHours: parseFloat(row[aeBudgetHoursIdx]) || 0,
          budgetCost: parseFloat(row[aeBudgetCostIdx]) || 0,
          budgetRevenue: budgetRevenue,
          actualHours: ptData.actualHours,
          actualCost: ptData.actualCost,
          actualRevenue: actualRevenue,
          variance: actualRevenue - budgetRevenue,
          usagePercent: budgetRevenue > 0 ? (actualRevenue / budgetRevenue) * 100 : 0
        });
      }
      
      const budgetRows = budgetData.sort((a, b) => 
        a.activitySeq.localeCompare(b.activitySeq)
      );
      
      setBudgetPivot(budgetRows);
      
      // Save to cache
      try {
        await savePivotCache('budget_pivot', budgetRows, ['AE.xlsx', 'PT.xlsx']);
        console.log('Saved Budget pivot to cache');
      } catch (error) {
        console.error('Failed to save Budget pivot to cache:', error);
      }
    }

    // Generate Project Summary Pivot (Aggregates by Project)
    if (data.p?.rows && data.pt?.rows) {
      const projectMap = new Map<string, any>();
      
      // Aggregate PT data by project
      for (let i = 1; i < data.pt.rows.length; i++) {
        const row = data.pt.rows[i];
        const projectId = row[0]; // Column A - Project ID
        
        if (!projectId) continue;
        
        const existing = projectMap.get(projectId) || {
          projectId,
          projectName: row[7] || '', // Column H - Project Description
          totalHours: 0,
          totalCost: 0,
          totalRevenue: 0,
          transactionCount: 0,
          activities: new Set()
        };
        
        existing.totalHours += parseFloat(row[18]) || 0;
        existing.totalCost += parseFloat(row[24]) || 0;
        existing.totalRevenue += parseFloat(row[33]) || 0;
        existing.transactionCount += 1;
        
        const activitySeq = row[4];
        if (activitySeq) {
          existing.activities.add(activitySeq);
        }
        
        projectMap.set(projectId, existing);
      }
      
      // Convert to array and calculate additional metrics
      const projectRows = Array.from(projectMap.values()).map(p => ({
        ...p,
        activityCount: p.activities.size,
        avgCostPerHour: p.totalHours > 0 ? p.totalCost / p.totalHours : 0,
        margin: p.totalRevenue - p.totalCost,
        marginPercent: p.totalRevenue > 0 ? ((p.totalRevenue - p.totalCost) / p.totalRevenue) * 100 : 0
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);
      
      setProjectPivot(projectRows);
      
      // Save to cache
      try {
        await savePivotCache('project_pivot', projectRows, ['P.xlsx', 'PT.xlsx']);
        console.log('Saved Project pivot to cache');
      } catch (error) {
        console.error('Failed to save Project pivot to cache:', error);
      }
    }
    
    setLastRefresh(new Date());
  };

  const formatLastRefresh = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, color: '#1f2937' }}>Pivot Tables</h2>
        {lastRefresh && (
          <div style={{ 
            fontSize: '14px', 
            color: '#64748b',
            padding: '8px 16px',
            background: isFromCache ? '#fef3c7' : '#dcfce7',
            borderRadius: '8px',
            border: isFromCache ? '1px solid #fde68a' : '1px solid #86efac'
          }}>
            {isFromCache ? '📦 Using cached data from ' : '✅ Fresh data from '}
            {formatLastRefresh(lastRefresh)}
            {isFromCache && ' (refresh weekly after new sales data)'}
          </div>
        )}
      </div>
      
      {/* Data Source Mapping Editor Modal */}
      {showMappingEditor && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999
            }}
            onClick={() => setShowMappingEditor(null)}
          />
          <DataSourceMapping 
            mappings={
              showMappingEditor === 'pt-transactions' ? ptTransactionMappings :
              showMappingEditor === 'budget-actual' ? budgetActualMappings :
              projectSummaryMappings
            }
            onMappingChange={handleMappingChange}
            onSaveAll={handleSaveAllMappings}
            onClose={() => setShowMappingEditor(null)}
            title={`Pivot Table Mappings - ${
              showMappingEditor === 'pt-transactions' ? 'PT Transactions' :
              showMappingEditor === 'budget-actual' ? 'Budget vs Actual' :
              'Project Summary'
            }`}
          />
        </>
      )}
      
      {/* PT Transactions Pivot */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#374151' }}>
            PT Transactions by Activity 
            <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '12px' }}>
              (Showing 5 of {ptPivot.length} rows)
            </span>
          </h3>
          <button
            onClick={() => setShowMappingEditor('pt-transactions')}
            style={{
              padding: '6px 12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              marginRight: '8px'
            }}
            title="Edit mappings for this table"
          >
            📊 Edit Mappings
          </button>
          <button
            onClick={() => ptColumnManager.setShowColumnManager(true)}
            style={{
              padding: '6px 12px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
            title="Manage columns for this table"
          >
            ⚙️ Columns
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <ColumnHeader 
                  label="Activity Seq" 
                  mapping={ptTransactionMappings.activitySeq}
                  onEditClick={() => setShowMappingEditor('pt-transactions')}
                />
                <ColumnHeader 
                  label="Project" 
                  mapping={ptTransactionMappings.project}
                  onEditClick={() => setShowMappingEditor('pt-transactions')}
                />
                <ColumnHeader 
                  label="Activity" 
                  mapping={ptTransactionMappings.activity}
                  onEditClick={() => setShowMappingEditor('pt-transactions')}
                />
                <ColumnHeader 
                  label="Hours" 
                  mapping={ptTransactionMappings.hours}
                  onEditClick={() => setShowMappingEditor('pt-transactions')}
                  textAlign="right"
                />
                <ColumnHeader 
                  label="Cost" 
                  mapping={ptTransactionMappings.cost}
                  onEditClick={() => setShowMappingEditor('pt-transactions')}
                  textAlign="right"
                />
                <ColumnHeader 
                  label="Revenue" 
                  mapping={ptTransactionMappings.revenue}
                  onEditClick={() => setShowMappingEditor('pt-transactions')}
                  textAlign="right"
                />
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {ptPivot.slice(0, 5).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}>{row.activitySeq}</td>
                  <td style={{ padding: '12px' }}>{row.projectDescription}</td>
                  <td style={{ padding: '12px' }}>{row.activityDescription}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{row.totalHours.toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${row.totalCost.toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${row.totalRevenue.toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{row.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget vs Actual Pivot */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#374151' }}>
            Budget vs Actual by Activity
            <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '12px' }}>
              (Showing 5 of {budgetPivot.length} rows)
            </span>
          </h3>
          <button
            onClick={() => setShowMappingEditor('budget-actual')}
            style={{
              padding: '6px 12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              marginRight: '8px'
            }}
            title="Edit mappings for this table"
          >
            📊 Edit Mappings
          </button>
          <button
            onClick={() => budgetColumnManager.setShowColumnManager(true)}
            style={{
              padding: '6px 12px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
            title="Manage columns for this table"
          >
            ⚙️ Columns
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <ColumnHeader 
                  label="Activity Seq" 
                  mapping={budgetActualMappings.activitySeq}
                  onEditClick={() => setShowMappingEditor('budget-actual')}
                />
                <ColumnHeader 
                  label="Project" 
                  mapping={budgetActualMappings.project}
                  onEditClick={() => setShowMappingEditor('budget-actual')}
                />
                <ColumnHeader 
                  label="Activity" 
                  mapping={budgetActualMappings.activity}
                  onEditClick={() => setShowMappingEditor('budget-actual')}
                />
                <ColumnHeader 
                  label="Budget Rev" 
                  mapping={budgetActualMappings.budgetRev}
                  onEditClick={() => setShowMappingEditor('budget-actual')}
                  textAlign="right"
                />
                <ColumnHeader 
                  label="Actual Rev" 
                  mapping={budgetActualMappings.actualRev}
                  onEditClick={() => setShowMappingEditor('budget-actual')}
                  textAlign="right"
                />
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Variance</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Usage %</th>
              </tr>
            </thead>
            <tbody>
              {budgetPivot.slice(0, 5).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}>{row.activitySeq}</td>
                  <td style={{ padding: '12px' }}>{row.projectName}</td>
                  <td style={{ padding: '12px' }}>{row.activityDescription}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${row.budgetRevenue.toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${row.actualRevenue.toFixed(2)}</td>
                  <td style={{ 
                    padding: '12px', 
                    textAlign: 'right',
                    color: row.variance >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    ${row.variance.toFixed(2)}
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    textAlign: 'right',
                    color: row.usagePercent > 100 ? '#ef4444' : row.usagePercent > 80 ? '#f59e0b' : '#10b981'
                  }}>
                    {row.usagePercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Summary Pivot */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#374151' }}>
            Project Summary
            <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '12px' }}>
              (Showing 5 of {projectPivot.length} rows)
            </span>
          </h3>
          <button
            onClick={() => setShowMappingEditor('project-summary')}
            style={{
              padding: '6px 12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
            title="Edit mappings for this table"
          >
            📊 Edit Mappings
          </button>
          <button
            onClick={() => projectColumnManager.setShowColumnManager(true)}
            style={{
              padding: '6px 12px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              marginLeft: '8px'
            }}
            title="Manage columns for this table"
          >
            ⚙️ Columns
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <ColumnHeader 
                  label="Project ID" 
                  mapping={projectSummaryMappings.projectId}
                  onEditClick={() => setShowMappingEditor('project-summary')}
                />
                <ColumnHeader 
                  label="Project Name" 
                  mapping={projectSummaryMappings.projectName}
                  onEditClick={() => setShowMappingEditor('project-summary')}
                />
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Activities</th>
                <ColumnHeader 
                  label="Hours" 
                  mapping={projectSummaryMappings.hours}
                  onEditClick={() => setShowMappingEditor('project-summary')}
                  textAlign="right"
                />
                <ColumnHeader 
                  label="Cost" 
                  mapping={projectSummaryMappings.cost}
                  onEditClick={() => setShowMappingEditor('project-summary')}
                  textAlign="right"
                />
                <ColumnHeader 
                  label="Revenue" 
                  mapping={projectSummaryMappings.revenue}
                  onEditClick={() => setShowMappingEditor('project-summary')}
                  textAlign="right"
                />
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Margin</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {projectPivot.slice(0, 5).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}>{row.projectId}</td>
                  <td style={{ padding: '12px' }}>{row.projectName}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{row.activityCount}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{row.totalHours.toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${row.totalCost.toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${row.totalRevenue.toFixed(2)}</td>
                  <td style={{ 
                    padding: '12px', 
                    textAlign: 'right',
                    color: row.margin >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    ${row.margin.toFixed(2)}
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    textAlign: 'right',
                    color: row.marginPercent >= 20 ? '#10b981' : row.marginPercent >= 10 ? '#f59e0b' : '#ef4444'
                  }}>
                    {row.marginPercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Column Manager Modals */}
      <ColumnManager
        columns={ptColumnManager.allColumns}
        hiddenColumns={ptColumnManager.hiddenColumns}
        customColumns={ptColumnManager.customColumns}
        onToggleColumn={ptColumnManager.toggleColumn}
        onAddColumn={ptColumnManager.addColumn}
        onRemoveColumn={ptColumnManager.removeColumn}
        isVisible={ptColumnManager.showColumnManager}
        onClose={() => ptColumnManager.setShowColumnManager(false)}
      />
      
      <ColumnManager
        columns={budgetColumnManager.allColumns}
        hiddenColumns={budgetColumnManager.hiddenColumns}
        customColumns={budgetColumnManager.customColumns}
        onToggleColumn={budgetColumnManager.toggleColumn}
        onAddColumn={budgetColumnManager.addColumn}
        onRemoveColumn={budgetColumnManager.removeColumn}
        isVisible={budgetColumnManager.showColumnManager}
        onClose={() => budgetColumnManager.setShowColumnManager(false)}
      />
      
      <ColumnManager
        columns={projectColumnManager.allColumns}
        hiddenColumns={projectColumnManager.hiddenColumns}
        customColumns={projectColumnManager.customColumns}
        onToggleColumn={projectColumnManager.toggleColumn}
        onAddColumn={projectColumnManager.addColumn}
        onRemoveColumn={projectColumnManager.removeColumn}
        isVisible={projectColumnManager.showColumnManager}
        onClose={() => projectColumnManager.setShowColumnManager(false)}
      />
    </div>
  );
};

export default PivotTables;