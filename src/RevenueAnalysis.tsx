import React, { useEffect, useState, useMemo } from 'react';

interface RevenueAnalysisProps {
  data: any;
}

interface RevenueData {
  date: Date;
  month: string;
  year: number;
  projectId: string;
  projectName: string;
  activitySeq: string;
  activityDescription: string;
  revenueType: 'T&E' | 'Fixed' | 'Other';
  amount: number;
  cost: number;
  hours: number;
}

const RevenueAnalysis: React.FC<RevenueAnalysisProps> = ({ data }) => {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedActivity, setSelectedActivity] = useState<string>('all');
  const [showCumulative, setShowCumulative] = useState(true);
  const [months, setMonths] = useState<string[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [activities, setActivities] = useState<{seq: string, description: string}[]>([]);

  useEffect(() => {
    if (!data?.pt?.rows) return;

    const processedData: RevenueData[] = [];
    const monthSet = new Set<string>();
    const projectSet = new Map<string, string>();
    const activitySet = new Map<string, string>();

    // Process PT data - skip header row
    for (let i = 1; i < data.pt.rows.length; i++) {
      const row = data.pt.rows[i];
      
      // Parse date
      let dateObj: Date;
      const dateValue = row[2]; // Column C - assuming date column
      
      if (typeof dateValue === 'string') {
        dateObj = new Date(dateValue);
      } else if (typeof dateValue === 'number') {
        // Excel serial date
        dateObj = new Date((dateValue - 25569) * 86400 * 1000);
      } else {
        continue;
      }

      if (isNaN(dateObj.getTime())) continue;

      const projectId = row[0] || '';
      const projectName = row[7] || ''; // Column H
      const activitySeq = String(row[4] || ''); // Column E
      const activityDesc = row[11] || ''; // Column L
      const revenue = parseFloat(row[33]) || 0; // Column AH - Sales Amount
      const cost = parseFloat(row[24]) || 0; // Column Y - Internal Amount
      const hours = parseFloat(row[18]) || 0; // Column S - Internal Quantity
      
      // Determine revenue type based on activity description or other criteria
      // This is a simplified logic - you may need to adjust based on your business rules
      let revenueType: 'T&E' | 'Fixed' | 'Other' = 'Other';
      
      if (activityDesc) {
        const descLower = activityDesc.toLowerCase();
        if (descLower.includes('t&e') || descLower.includes('time') || descLower.includes('expense') || 
            descLower.includes('hourly') || descLower.includes('consulting')) {
          revenueType = 'T&E';
        } else if (descLower.includes('fixed') || descLower.includes('milestone') || 
                   descLower.includes('deliverable') || descLower.includes('product')) {
          revenueType = 'Fixed';
        }
      }
      
      // Alternative: Use activity seq ranges or project types to determine revenue type
      // For example: Activity seq 100000-199999 = T&E, 200000-299999 = Fixed
      const activityNum = parseInt(activitySeq);
      if (!isNaN(activityNum)) {
        if (activityNum >= 100000 && activityNum < 200000) {
          revenueType = 'T&E';
        } else if (activityNum >= 200000 && activityNum < 300000) {
          revenueType = 'Fixed';
        }
      }

      const month = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      processedData.push({
        date: dateObj,
        month,
        year: dateObj.getFullYear(),
        projectId,
        projectName,
        activitySeq,
        activityDescription: activityDesc,
        revenueType,
        amount: revenue,
        cost,
        hours
      });

      // Collect unique values
      monthSet.add(month);
      if (projectId) projectSet.set(projectId, projectName);
      if (activitySeq && activitySeq !== '0') activitySet.set(activitySeq, activityDesc);
    }

    setRevenueData(processedData);
    setMonths(Array.from(monthSet).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    }));
    setProjects(Array.from(projectSet.entries()).map(([id, name]) => ({ id, name })));
    setActivities(Array.from(activitySet.entries()).map(([seq, description]) => ({ seq, description })));
  }, [data]);

  // Filter data
  const filteredData = useMemo(() => {
    let filtered = [...revenueData];

    if (selectedMonth !== 'all') {
      filtered = filtered.filter(d => d.month === selectedMonth);
    }

    if (selectedProject !== 'all') {
      filtered = filtered.filter(d => d.projectId === selectedProject);
    }

    if (selectedActivity !== 'all') {
      filtered = filtered.filter(d => d.activitySeq === selectedActivity);
    }

    return filtered;
  }, [revenueData, selectedMonth, selectedProject, selectedActivity]);

  // Aggregate by month and revenue type
  const monthlyData = useMemo(() => {
    const grouped = new Map<string, any>();

    // Get all months in the data range
    const allMonths = [...new Set(revenueData.map(d => d.month))].sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });

    // Initialize all months with zero values
    allMonths.forEach(month => {
      grouped.set(month, {
        month,
        teRevenue: 0,
        fixedRevenue: 0,
        otherRevenue: 0,
        totalRevenue: 0,
        teCost: 0,
        fixedCost: 0,
        otherCost: 0,
        totalCost: 0,
        teHours: 0,
        fixedHours: 0,
        entries: 0
      });
    });

    // Aggregate filtered data
    filteredData.forEach(item => {
      const existing = grouped.get(item.month);
      
      if (existing) {
        if (item.revenueType === 'T&E') {
          existing.teRevenue += item.amount;
          existing.teCost += item.cost;
          existing.teHours += item.hours;
        } else if (item.revenueType === 'Fixed') {
          existing.fixedRevenue += item.amount;
          existing.fixedCost += item.cost;
          existing.fixedHours += item.hours;
        } else {
          existing.otherRevenue += item.amount;
          existing.otherCost += item.cost;
        }
        
        existing.totalRevenue += item.amount;
        existing.totalCost += item.cost;
        existing.entries += 1;
      }
    });

    const sortedData = Array.from(grouped.values()).sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate cumulative values if needed
    if (showCumulative) {
      let cumTeRevenue = 0;
      let cumFixedRevenue = 0;
      let cumOtherRevenue = 0;
      let cumTotalRevenue = 0;

      sortedData.forEach(item => {
        cumTeRevenue += item.teRevenue;
        cumFixedRevenue += item.fixedRevenue;
        cumOtherRevenue += item.otherRevenue;
        cumTotalRevenue += item.totalRevenue;

        item.cumTeRevenue = cumTeRevenue;
        item.cumFixedRevenue = cumFixedRevenue;
        item.cumOtherRevenue = cumOtherRevenue;
        item.cumTotalRevenue = cumTotalRevenue;
      });
    }

    return sortedData;
  }, [filteredData, showCumulative, revenueData]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredData.reduce((acc, item) => {
      if (item.revenueType === 'T&E') {
        acc.teRevenue += item.amount;
        acc.teCost += item.cost;
        acc.teHours += item.hours;
      } else if (item.revenueType === 'Fixed') {
        acc.fixedRevenue += item.amount;
        acc.fixedCost += item.cost;
        acc.fixedHours += item.hours;
      } else {
        acc.otherRevenue += item.amount;
        acc.otherCost += item.cost;
      }
      acc.totalRevenue += item.amount;
      acc.totalCost += item.cost;
      acc.totalHours += item.hours;
      return acc;
    }, {
      teRevenue: 0,
      fixedRevenue: 0,
      otherRevenue: 0,
      totalRevenue: 0,
      teCost: 0,
      fixedCost: 0,
      otherCost: 0,
      totalCost: 0,
      teHours: 0,
      fixedHours: 0,
      totalHours: 0
    });
  }, [filteredData]);

  const tePercentage = totals.totalRevenue > 0 ? (totals.teRevenue / totals.totalRevenue) * 100 : 0;
  const fixedPercentage = totals.totalRevenue > 0 ? (totals.fixedRevenue / totals.totalRevenue) * 100 : 0;

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
            💰 Revenue Analysis - T&E vs Fixed
          </h1>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={showCumulative}
                onChange={(e) => setShowCumulative(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Show Cumulative
            </label>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '25px',
          padding: '15px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            >
              <option value="all">All Months</option>
              {months.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.id} - {p.name || 'No Name'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Activity
            </label>
            <select
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            >
              <option value="all">All Activities</option>
              {activities.map(a => (
                <option key={a.seq} value={a.seq}>
                  {a.seq} - {a.description || 'No Description'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '15px',
          marginBottom: '25px'
        }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            borderLeft: '4px solid #3b82f6'
          }}>
            <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '5px' }}>
              T&E REVENUE
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>
              ${totals.teRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '12px', color: '#1e3a8a' }}>
              {tePercentage.toFixed(1)}% of total • {totals.teHours.toFixed(0)} hours
            </div>
            <div style={{
              marginTop: '8px',
              height: '4px',
              backgroundColor: '#bfdbfe',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${tePercentage}%`,
                height: '100%',
                backgroundColor: '#3b82f6'
              }} />
            </div>
          </div>

          <div style={{
            padding: '15px',
            backgroundColor: '#dcfce7',
            borderRadius: '8px',
            borderLeft: '4px solid #22c55e'
          }}>
            <div style={{ fontSize: '12px', color: '#166534', marginBottom: '5px' }}>
              FIXED REVENUE
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>
              ${totals.fixedRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '12px', color: '#14532d' }}>
              {fixedPercentage.toFixed(1)}% of total • {totals.fixedHours.toFixed(0)} hours
            </div>
            <div style={{
              marginTop: '8px',
              height: '4px',
              backgroundColor: '#bbf7d0',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${fixedPercentage}%`,
                height: '100%',
                backgroundColor: '#22c55e'
              }} />
            </div>
          </div>

          <div style={{
            padding: '15px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            borderLeft: '4px solid #f59e0b'
          }}>
            <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '5px' }}>
              TOTAL REVENUE
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#d97706' }}>
              ${totals.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '12px', color: '#78350f' }}>
              Margin: ${(totals.totalRevenue - totals.totalCost).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Monthly Breakdown Table */}
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
                  Month
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  T&E Revenue
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Fixed Revenue
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Total Revenue
                </th>
                {showCumulative && (
                  <>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'right', 
                      borderBottom: '2px solid #e5e7eb',
                      backgroundColor: '#eff6ff'
                    }}>
                      Cum. T&E
                    </th>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'right', 
                      borderBottom: '2px solid #e5e7eb',
                      backgroundColor: '#eff6ff'
                    }}>
                      Cum. Fixed
                    </th>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'right', 
                      borderBottom: '2px solid #e5e7eb',
                      backgroundColor: '#eff6ff'
                    }}>
                      Cum. Total
                    </th>
                  </>
                )}
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>
                  T&E %
                </th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>
                  Fixed %
                </th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row, index) => {
                const monthTePercent = row.totalRevenue > 0 ? (row.teRevenue / row.totalRevenue) * 100 : 0;
                const monthFixedPercent = row.totalRevenue > 0 ? (row.fixedRevenue / row.totalRevenue) * 100 : 0;
                
                return (
                  <tr 
                    key={row.month}
                    style={{
                      backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                    }}
                  >
                    <td style={{ 
                      padding: '12px',
                      fontWeight: '500',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                    }}>
                      {row.month}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#2563eb' }}>
                      ${row.teRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#16a34a' }}>
                      ${row.fixedRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                      ${row.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    {showCumulative && (
                      <>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right',
                          backgroundColor: '#eff6ff',
                          color: '#1e40af'
                        }}>
                          ${row.cumTeRevenue?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right',
                          backgroundColor: '#eff6ff',
                          color: '#166534'
                        }}>
                          ${row.cumFixedRevenue?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right',
                          backgroundColor: '#eff6ff',
                          fontWeight: '600'
                        }}>
                          ${row.cumTotalRevenue?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      </>
                    )}
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '6px',
                          backgroundColor: '#e5e7eb',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${monthTePercent}%`,
                            height: '100%',
                            backgroundColor: '#3b82f6'
                          }} />
                        </div>
                        <span style={{ fontSize: '12px' }}>
                          {monthTePercent.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '6px',
                          backgroundColor: '#e5e7eb',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${monthFixedPercent}%`,
                            height: '100%',
                            backgroundColor: '#22c55e'
                          }} />
                        </div>
                        <span style={{ fontSize: '12px' }}>
                          {monthFixedPercent.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {monthlyData.length > 0 && (
              <tfoot>
                <tr style={{ 
                  borderTop: '2px solid #e5e7eb',
                  backgroundColor: '#f3f4f6',
                  fontWeight: '600'
                }}>
                  <td style={{ padding: '12px' }}>TOTAL</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#2563eb' }}>
                    ${totals.teRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#16a34a' }}>
                    ${totals.fixedRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ${totals.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  {showCumulative && (
                    <td colSpan={3} style={{ padding: '12px', backgroundColor: '#eff6ff' }}></td>
                  )}
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {tePercentage.toFixed(0)}%
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {fixedPercentage.toFixed(0)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          
          {monthlyData.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>💰</div>
              <div style={{ fontSize: '18px', fontWeight: '500' }}>
                No revenue data available
              </div>
              <div style={{ fontSize: '14px', marginTop: '5px' }}>
                Check your filters or data source
              </div>
            </div>
          )}
        </div>

        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#92400e'
        }}>
          <strong>📊 Revenue Type Classification:</strong>
          <ul style={{ marginTop: '8px', marginLeft: '20px', lineHeight: '1.6' }}>
            <li><strong>T&E (Time & Expenses):</strong> Revenue from hourly billing, consulting, and reimbursable expenses</li>
            <li><strong>Fixed:</strong> Revenue from fixed-price contracts, milestones, and deliverables</li>
            <li>Classification is based on activity descriptions and sequence numbers</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RevenueAnalysis;