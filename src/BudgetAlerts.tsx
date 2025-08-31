import React, { useEffect, useState } from 'react';

interface BudgetAlertsProps {
  data: any;
}

interface AlertRow {
  activitySeq: string;
  projectId: string;
  projectName: string;
  activityDescription: string;
  budgetCost: number;
  actualCost: number;
  budgetRevenue: number;
  actualRevenue: number;
  budgetHours: number;
  actualHours: number;
  costUsagePercent: number;
  hoursUsagePercent: number;
  variance: number;
  severity: 'critical' | 'warning' | 'attention';
}

const BudgetAlerts: React.FC<BudgetAlertsProps> = ({ data }) => {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [threshold, setThreshold] = useState(80);
  const [sortBy, setSortBy] = useState<'usage' | 'variance' | 'cost'>('usage');

  useEffect(() => {
    if (!data?.ae?.rows || !data?.pt?.rows) return;

    // Create PT aggregation map
    const ptMap = new Map<string, any>();
    for (let i = 1; i < data.pt.rows.length; i++) {
      const row = data.pt.rows[i];
      const activitySeq = String(row[4]); // Column E - Activity Seq
      
      if (!activitySeq || activitySeq === '0') continue;
      
      const existing = ptMap.get(activitySeq) || {
        actualHours: 0,
        actualCost: 0,
        actualRevenue: 0,
        projectDescription: row[7] || '', // Column H
        activityDescription: row[11] || '' // Column L
      };
      
      existing.actualHours += parseFloat(row[18]) || 0; // Column S - Internal Quantity
      existing.actualCost += parseFloat(row[24]) || 0; // Column Y - Internal Amount
      existing.actualRevenue += parseFloat(row[33]) || 0; // Column AH - Sales Amount
      
      // Capture descriptions
      if (!existing.projectDescription && row[7]) {
        existing.projectDescription = row[7];
      }
      if (!existing.activityDescription && row[11]) {
        existing.activityDescription = row[11];
      }
      
      ptMap.set(activitySeq, existing);
    }

    // Now process AE data and create alerts
    const alertList: AlertRow[] = [];
    
    for (let i = 1; i < data.ae.rows.length; i++) {
      const row = data.ae.rows[i];
      const activitySeq = String(row[18]); // Column S in AE
      
      if (!activitySeq || activitySeq === '0') continue;
      
      const actual = ptMap.get(activitySeq);
      if (!actual) continue; // Skip if no actuals
      
      const budgetCost = parseFloat(row[10]) || 0; // Column K
      const budgetRevenue = parseFloat(row[11]) || 0; // Column L
      const budgetHours = parseFloat(row[12]) || 0; // Column M
      
      // Calculate usage percentages
      const costUsage = budgetCost > 0 ? (actual.actualCost / budgetCost) * 100 : 0;
      const hoursUsage = budgetHours > 0 ? (actual.actualHours / budgetHours) * 100 : 0;
      
      // Only include if over threshold
      if (costUsage >= threshold || hoursUsage >= threshold) {
        const variance = actual.actualCost - budgetCost;
        
        let severity: 'critical' | 'warning' | 'attention';
        if (costUsage >= 100 || hoursUsage >= 100) {
          severity = 'critical';
        } else if (costUsage >= 90 || hoursUsage >= 90) {
          severity = 'warning';
        } else {
          severity = 'attention';
        }
        
        alertList.push({
          activitySeq,
          projectId: row[1] || '', // Column B
          projectName: row[2] || actual.projectDescription || '', // Column C or from PT
          activityDescription: row[6] || actual.activityDescription || '', // Column G or from PT
          budgetCost,
          actualCost: actual.actualCost,
          budgetRevenue,
          actualRevenue: actual.actualRevenue,
          budgetHours,
          actualHours: actual.actualHours,
          costUsagePercent: costUsage,
          hoursUsagePercent: hoursUsage,
          variance,
          severity
        });
      }
    }

    // Sort the alerts
    alertList.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return b.costUsagePercent - a.costUsagePercent;
        case 'variance':
          return b.variance - a.variance;
        case 'cost':
          return b.actualCost - a.actualCost;
        default:
          return 0;
      }
    });

    setAlerts(alertList);
  }, [data, threshold, sortBy]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'warning': return '#f59e0b';
      case 'attention': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return '#fee2e2';
      case 'warning': return '#fef3c7';
      case 'attention': return '#dbeafe';
      default: return '#f3f4f6';
    }
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold',
            color: '#1f2937'
          }}>
            ⚠️ Budget Alert Dashboard
          </h1>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div>
              <label style={{ marginRight: '10px', fontSize: '14px' }}>Threshold:</label>
              <select 
                value={threshold} 
                onChange={(e) => setThreshold(Number(e.target.value))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px'
                }}
              >
                <option value={50}>≥ 50%</option>
                <option value={70}>≥ 70%</option>
                <option value={80}>≥ 80%</option>
                <option value={90}>≥ 90%</option>
                <option value={100}>≥ 100%</option>
              </select>
            </div>
            
            <div>
              <label style={{ marginRight: '10px', fontSize: '14px' }}>Sort by:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px'
                }}
              >
                <option value="usage">Usage %</option>
                <option value="variance">Variance $</option>
                <option value="cost">Actual Cost</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '25px'
        }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#fee2e2',
            borderRadius: '8px',
            borderLeft: '4px solid #dc2626'
          }}>
            <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '5px' }}>
              CRITICAL (≥100%)
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>
              {alerts.filter(a => a.severity === 'critical').length}
            </div>
            <div style={{ fontSize: '12px', color: '#7f1d1d' }}>
              Over budget
            </div>
          </div>

          <div style={{
            padding: '15px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            borderLeft: '4px solid #f59e0b'
          }}>
            <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '5px' }}>
              WARNING (90-99%)
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
              {alerts.filter(a => a.severity === 'warning').length}
            </div>
            <div style={{ fontSize: '12px', color: '#78350f' }}>
              Near limit
            </div>
          </div>

          <div style={{
            padding: '15px',
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            borderLeft: '4px solid #3b82f6'
          }}>
            <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '5px' }}>
              ATTENTION ({threshold}-89%)
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>
              {alerts.filter(a => a.severity === 'attention').length}
            </div>
            <div style={{ fontSize: '12px', color: '#1e3a8a' }}>
              Monitor closely
            </div>
          </div>

          <div style={{
            padding: '15px',
            backgroundColor: '#f3e8ff',
            borderRadius: '8px',
            borderLeft: '4px solid #9333ea'
          }}>
            <div style={{ fontSize: '12px', color: '#6b21a8', marginBottom: '5px' }}>
              TOTAL ALERTS
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#9333ea' }}>
              {alerts.length}
            </div>
            <div style={{ fontSize: '12px', color: '#581c87' }}>
              Activities at risk
            </div>
          </div>
        </div>

        {/* Alert Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: '0',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: '600',
                  borderBottom: '2px solid #e5e7eb',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#f9fafb'
                }}>
                  Activity
                </th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                  Project
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Budget Cost
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Actual Cost
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Cost Usage
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Hours Usage
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Variance
                </th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, index) => (
                <tr 
                  key={alert.activitySeq}
                  style={{
                    backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = getSeverityBg(alert.severity)}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9fafb'}
                >
                  <td style={{ 
                    padding: '12px',
                    fontWeight: '500',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: 'inherit'
                  }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>
                      {alert.activitySeq}
                    </div>
                    <div style={{ fontSize: '13px', color: '#1f2937' }}>
                      {alert.activityDescription || 'No description'}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>
                      {alert.projectId}
                    </div>
                    <div style={{ fontSize: '13px', color: '#1f2937' }}>
                      {alert.projectName || 'No name'}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ${alert.budgetCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                    ${alert.actualCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '60px',
                        height: '8px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(alert.costUsagePercent, 100)}%`,
                          height: '100%',
                          backgroundColor: getSeverityColor(alert.severity),
                          transition: 'width 0.3s'
                        }} />
                      </div>
                      <span style={{ 
                        fontWeight: '600',
                        color: getSeverityColor(alert.severity)
                      }}>
                        {alert.costUsagePercent.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '60px',
                        height: '8px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(alert.hoursUsagePercent, 100)}%`,
                          height: '100%',
                          backgroundColor: alert.hoursUsagePercent >= 100 ? '#dc2626' :
                                         alert.hoursUsagePercent >= 90 ? '#f59e0b' : '#3b82f6',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                      <span style={{ fontSize: '13px' }}>
                        {alert.hoursUsagePercent.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    textAlign: 'right',
                    color: alert.variance > 0 ? '#dc2626' : '#059669',
                    fontWeight: '600'
                  }}>
                    {alert.variance > 0 ? '+' : ''}
                    ${alert.variance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: getSeverityBg(alert.severity),
                      color: getSeverityColor(alert.severity),
                      textTransform: 'uppercase'
                    }}>
                      {alert.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {alerts.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>✅</div>
              <div style={{ fontSize: '18px', fontWeight: '500' }}>
                No activities exceed {threshold}% budget usage
              </div>
              <div style={{ fontSize: '14px', marginTop: '5px' }}>
                All activities are within acceptable budget limits
              </div>
            </div>
          )}
        </div>

        {alerts.length > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#92400e'
          }}>
            <strong>📊 Budget Alert Legend:</strong>
            <ul style={{ marginTop: '8px', marginLeft: '20px', lineHeight: '1.6' }}>
              <li><strong>Critical:</strong> Activities that have exceeded their budget (≥100%)</li>
              <li><strong>Warning:</strong> Activities approaching budget limit (90-99%)</li>
              <li><strong>Attention:</strong> Activities requiring monitoring ({threshold}-89%)</li>
              <li><strong>Variance:</strong> Difference between actual and budgeted cost (negative = under budget)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetAlerts;