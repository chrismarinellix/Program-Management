import React, { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (!data) return;

    // Generate PT Pivot Table (Aggregates transactions by Activity Seq)
    if (data.pt?.rows) {
      const pivotMap = new Map<string, PivotRow>();
      
      // Skip header row (index 0)
      for (let i = 1; i < data.pt.rows.length; i++) {
        const row = data.pt.rows[i];
        const activitySeq = row[4]; // Column E - Activity Seq (CORRECTED from F)
        
        if (!activitySeq || activitySeq === 0) continue;
        
        const key = String(activitySeq);
        const existing = pivotMap.get(key) || {
          activitySeq: key,
          projectId: row[0] || '', // Column A - Project ID
          projectDescription: row[7] || '', // Column H - Project Description  
          activityDescription: row[11] || '', // Column L - Activity Description
          totalHours: 0,
          totalCost: 0,
          totalRevenue: 0,
          transactionCount: 0
        };
        
        // Update descriptions if not already set
        if (!existing.projectDescription && row[7]) {
          existing.projectDescription = row[7];
        }
        if (!existing.activityDescription && row[11]) {
          existing.activityDescription = row[11];
        }
        
        existing.totalHours += parseFloat(row[18]) || 0; // Column S - Internal Quantity  
        existing.totalCost += parseFloat(row[24]) || 0; // Column Y - Internal Amount
        existing.totalRevenue += parseFloat(row[33]) || 0; // Column AH - Sales Amount (corrected from AI)
        existing.transactionCount += 1;
        
        pivotMap.set(key, existing);
      }
      
      setPtPivot(Array.from(pivotMap.values()).sort((a, b) => 
        a.activitySeq.localeCompare(b.activitySeq)
      ));
    }

    // Generate Budget vs Actual Pivot (Joins AE and PT data)
    if (data.ae?.rows && data.pt?.rows) {
      // First create PT aggregation map
      const ptMap = new Map<string, any>();
      for (let i = 1; i < data.pt.rows.length; i++) {
        const row = data.pt.rows[i];
        const activitySeq = String(row[4]); // Column E - Activity Seq (CORRECTED)
        
        if (!activitySeq || activitySeq === '0') continue;
        
        const existing = ptMap.get(activitySeq) || {
          actualHours: 0,
          actualCost: 0,
          actualRevenue: 0
        };
        
        existing.actualHours += parseFloat(row[18]) || 0;
        existing.actualCost += parseFloat(row[24]) || 0;
        existing.actualRevenue += parseFloat(row[33]) || 0; // Column AH - Sales Amount (corrected)
        
        ptMap.set(activitySeq, existing);
      }

      // Now join with AE data
      const budgetData: BudgetPivotRow[] = [];
      for (let i = 1; i < data.ae.rows.length; i++) {
        const row = data.ae.rows[i];
        const activitySeq = String(row[18]); // Column S in AE
        
        if (!activitySeq || activitySeq === '0') continue;
        
        const ptData = ptMap.get(activitySeq) || {
          actualHours: 0,
          actualCost: 0,
          actualRevenue: 0
        };
        
        const budgetRevenue = parseFloat(row[11]) || 0;
        const actualRevenue = ptData.actualRevenue;
        
        budgetData.push({
          activitySeq,
          projectId: row[1] || '', // Column B
          projectName: row[2] || '', // Column C
          activityDescription: row[6] || '', // Column G
          budgetHours: parseFloat(row[12]) || 0, // Column M
          budgetCost: parseFloat(row[10]) || 0, // Column K
          budgetRevenue: budgetRevenue, // Column L
          actualHours: ptData.actualHours,
          actualCost: ptData.actualCost,
          actualRevenue: actualRevenue,
          variance: actualRevenue - budgetRevenue,
          usagePercent: budgetRevenue > 0 ? (actualRevenue / budgetRevenue) * 100 : 0
        });
      }
      
      setBudgetPivot(budgetData);
    }

    // Generate Project Summary Pivot
    if (data.p?.rows && data.pt?.rows) {
      const projectMap = new Map<string, any>();
      
      // Aggregate PT data by project
      for (let i = 1; i < data.pt.rows.length; i++) {
        const row = data.pt.rows[i];
        const projectId = row[0]; // Assuming project ID is in column A
        
        if (!projectId) continue;
        
        const existing = projectMap.get(projectId) || {
          projectId,
          totalCost: 0,
          totalRevenue: 0,
          totalHours: 0,
          transactionCount: 0
        };
        
        existing.totalCost += parseFloat(row[24]) || 0;
        existing.totalRevenue += parseFloat(row[34]) || 0;
        existing.totalHours += parseFloat(row[18]) || 0;
        existing.transactionCount += 1;
        
        projectMap.set(projectId, existing);
      }
      
      // Enhance with P.xlsx data
      const projectData = Array.from(projectMap.values()).map(proj => {
        const pRow = data.p.rows.find((row: any, idx: number) => 
          idx > 0 && row[0] === proj.projectId
        );
        
        return {
          ...proj,
          projectName: pRow ? pRow[1] : 'Unknown',
          status: pRow ? pRow[9] : 'Unknown'
        };
      });
      
      setProjectPivot(projectData);
    }
  }, [data]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <h1 style={{ marginBottom: '20px', color: '#1f2937' }}>📊 Generated Pivot Tables</h1>
      
      {/* Explanation */}
      <div style={{
        backgroundColor: '#e3f2fd',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '30px',
        border: '1px solid #2196f3'
      }}>
        <h3 style={{ color: '#1565c0', marginBottom: '10px' }}>🔍 How These Pivot Tables Work</h3>
        <p style={{ color: '#424242', marginBottom: '10px' }}>
          These are the <strong>in-memory pivot tables</strong> that the application creates to calculate budget vs actual metrics.
          Instead of using Excel pivot tables, the app aggregates data programmatically:
        </p>
        <ol style={{ marginLeft: '20px', color: '#424242' }}>
          <li><strong>PT Pivot:</strong> Groups all transactions by Activity Seq, summing hours, costs, and revenues</li>
          <li><strong>Budget vs Actual:</strong> Joins AE (budget) with aggregated PT (actuals) on Activity Seq</li>
          <li><strong>Project Summary:</strong> Aggregates all transactions by Project ID</li>
        </ol>
      </div>

      {/* PT Transactions Pivot Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '30px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#2e7d32', marginBottom: '15px' }}>
          📈 PT Transactions Pivot (GROUP BY Activity Seq)
        </h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
          Source: <strong>PT.xlsx</strong> | 
          Aggregation: <strong>SUM by Activity Seq (Column E)</strong> | 
          Hours: <strong>Internal Quantity (Column S)</strong>
        </p>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#4caf50', color: 'white' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Activity Seq</th>
                <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Project Description</th>
                <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>Activity Description</th>
                <th style={{ padding: '10px', textAlign: 'right', borderRight: '1px solid #ddd' }}>Total Hours<br/>(Internal Qty)</th>
                <th style={{ padding: '10px', textAlign: 'right', borderRight: '1px solid #ddd' }}>Total Cost</th>
                <th style={{ padding: '10px', textAlign: 'right', borderRight: '1px solid #ddd' }}>Total Revenue</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {ptPivot.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    No data available - Click "Force Reload All Data" to load
                  </td>
                </tr>
              ) : (
                ptPivot.slice(0, 20).map((row, idx) => (
                  <tr key={idx} style={{ 
                    borderBottom: '1px solid #ddd',
                    backgroundColor: idx % 2 === 0 ? '#fff' : '#f5f5f5'
                  }}>
                    <td style={{ padding: '8px', fontWeight: 'bold', fontSize: '12px' }}>{row.activitySeq}</td>
                    <td style={{ padding: '8px', fontSize: '12px' }}>{row.projectDescription || '-'}</td>
                    <td style={{ padding: '8px', fontSize: '12px' }}>{row.activityDescription || '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatNumber(row.totalHours)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(row.totalCost)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(row.totalRevenue)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{row.transactionCount}</td>
                  </tr>
                ))
              )}
            </tbody>
            {ptPivot.length > 20 && (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ 
                    padding: '10px', 
                    textAlign: 'center', 
                    backgroundColor: '#fff3cd',
                    color: '#856404'
                  }}>
                    Showing 20 of {ptPivot.length} rows
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Budget vs Actual Pivot Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '30px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#1565c0', marginBottom: '15px' }}>
          💰 Budget vs Actual Pivot (JOIN AE + PT)
        </h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
          Source: <strong>AE.xlsx LEFT JOIN PT Pivot</strong> | 
          Join Key: <strong>Activity Seq (AE.S = PT.F)</strong>
        </p>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#2196f3', color: 'white' }}>
                <th rowSpan={2} style={{ padding: '10px', borderRight: '1px solid #ddd' }}>Activity Seq</th>
                <th rowSpan={2} style={{ padding: '10px', borderRight: '1px solid #ddd' }}>Project</th>
                <th colSpan={3} style={{ padding: '10px', borderRight: '1px solid #ddd', textAlign: 'center' }}>Budget (AE)</th>
                <th colSpan={3} style={{ padding: '10px', borderRight: '1px solid #ddd', textAlign: 'center' }}>Actual (PT)</th>
                <th rowSpan={2} style={{ padding: '10px', textAlign: 'center' }}>Usage %</th>
              </tr>
              <tr style={{ backgroundColor: '#1976d2', color: 'white' }}>
                <th style={{ padding: '8px', borderRight: '1px solid #ddd' }}>Hours</th>
                <th style={{ padding: '8px', borderRight: '1px solid #ddd' }}>Cost</th>
                <th style={{ padding: '8px', borderRight: '1px solid #ddd' }}>Revenue</th>
                <th style={{ padding: '8px', borderRight: '1px solid #ddd' }}>Hours</th>
                <th style={{ padding: '8px', borderRight: '1px solid #ddd' }}>Cost</th>
                <th style={{ padding: '8px', borderRight: '1px solid #ddd' }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {budgetPivot.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    No data available - Click "Force Reload All Data" to load
                  </td>
                </tr>
              ) : (
                budgetPivot.slice(0, 15).map((row, idx) => (
                  <tr key={idx} style={{ 
                    borderBottom: '1px solid #ddd',
                    backgroundColor: idx % 2 === 0 ? '#fff' : '#f5f5f5'
                  }}>
                    <td style={{ padding: '6px', fontSize: '12px' }}>{row.activitySeq}</td>
                    <td style={{ padding: '6px', fontSize: '12px' }}>
                      <div>{row.projectId}</div>
                      <div style={{ fontSize: '11px', color: '#666' }}>{row.activityDescription}</div>
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{formatNumber(row.budgetHours)}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(row.budgetCost)}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(row.budgetRevenue)}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{formatNumber(row.actualHours)}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(row.actualCost)}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(row.actualRevenue)}</td>
                    <td style={{ 
                      padding: '6px', 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: row.usagePercent > 100 ? '#d32f2f' : 
                             row.usagePercent > 80 ? '#f57c00' : '#388e3c'
                    }}>
                      {row.budgetRevenue === 0 && row.actualRevenue > 0 ? 
                        '∞' : 
                        row.usagePercent.toFixed(1) + '%'
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL-like Query Explanation */}
      <div style={{
        backgroundColor: '#263238',
        color: '#aed581',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        fontFamily: 'Courier New, monospace',
        fontSize: '14px'
      }}>
        <h3 style={{ color: '#4fc3f7', marginBottom: '15px' }}>🔧 SQL Equivalent Queries</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: '#81c784', marginBottom: '5px' }}>-- PT Pivot Table (Column E = Activity Seq)</div>
          <code style={{ color: '#fff' }}>
            SELECT <br/>
            &nbsp;&nbsp;E AS Activity_Seq,<br/>
            &nbsp;&nbsp;B AS Project_Description,<br/>
            &nbsp;&nbsp;G AS Activity_Description,<br/>
            &nbsp;&nbsp;SUM(S) AS Total_Hours, -- Internal Quantity<br/>
            &nbsp;&nbsp;SUM(Y) AS Total_Cost, -- Internal Amount<br/>
            &nbsp;&nbsp;SUM(AI) AS Total_Revenue, -- Sales Amount<br/>
            &nbsp;&nbsp;COUNT(*) AS Transaction_Count<br/>
            FROM PT_Sheet<br/>
            WHERE E IS NOT NULL -- Activity Seq in Column E<br/>
            GROUP BY E, B, G<br/>
            ORDER BY E;
          </code>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: '#81c784', marginBottom: '5px' }}>-- Budget vs Actual Join</div>
          <code style={{ color: '#fff' }}>
            SELECT <br/>
            &nbsp;&nbsp;ae.Activity_Seq,<br/>
            &nbsp;&nbsp;ae.Project_ID,<br/>
            &nbsp;&nbsp;ae.Estimated_Hours AS Budget_Hours,<br/>
            &nbsp;&nbsp;ae.Estimated_Cost AS Budget_Cost,<br/>
            &nbsp;&nbsp;ae.Estimated_Revenue AS Budget_Revenue,<br/>
            &nbsp;&nbsp;COALESCE(pt.Total_Hours, 0) AS Actual_Hours,<br/>
            &nbsp;&nbsp;COALESCE(pt.Total_Cost, 0) AS Actual_Cost,<br/>
            &nbsp;&nbsp;COALESCE(pt.Total_Revenue, 0) AS Actual_Revenue,<br/>
            &nbsp;&nbsp;CASE <br/>
            &nbsp;&nbsp;&nbsp;&nbsp;WHEN ae.Estimated_Revenue = 0 THEN NULL<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;ELSE (pt.Total_Revenue / ae.Estimated_Revenue) * 100<br/>
            &nbsp;&nbsp;END AS Usage_Percent<br/>
            FROM AE_Sheet ae<br/>
            LEFT JOIN (<br/>
            &nbsp;&nbsp;SELECT Activity_Seq, SUM(...) AS Total_...<br/>
            &nbsp;&nbsp;FROM PT_Sheet GROUP BY Activity_Seq<br/>
            ) pt ON ae.Activity_Seq = pt.Activity_Seq;
          </code>
        </div>
      </div>
    </div>
  );
};

export default PivotTables;