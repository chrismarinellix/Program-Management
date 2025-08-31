import React, { useEffect, useState, useMemo } from 'react';

interface HoursTrackingProps {
  data: any;
}

interface HoursData {
  date: Date;
  projectId: string;
  projectName: string;
  activitySeq: string;
  activityDescription: string;
  hours: number;
  cost: number;
  revenue: number;
  month: string;
  year: number;
}

const HoursTracking: React.FC<HoursTrackingProps> = ({ data }) => {
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedActivity, setSelectedActivity] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [hoursData, setHoursData] = useState<HoursData[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [activities, setActivities] = useState<{seq: string, description: string}[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);

  useEffect(() => {
    if (!data?.pt?.rows) return;

    const processedData: HoursData[] = [];
    const projectSet = new Map<string, string>();
    const activitySet = new Map<string, string>();
    const periodSet = new Set<string>();

    // Skip header row (index 0), process actual data
    for (let i = 1; i < data.pt.rows.length; i++) {
      const row = data.pt.rows[i];
      
      // Parse date from column C (index 2) - assuming it's a date column
      let dateObj: Date;
      const dateValue = row[2];
      
      if (typeof dateValue === 'string') {
        dateObj = new Date(dateValue);
      } else if (typeof dateValue === 'number') {
        // Excel serial date number
        dateObj = new Date((dateValue - 25569) * 86400 * 1000);
      } else {
        continue; // Skip if no valid date
      }

      if (isNaN(dateObj.getTime())) continue;

      const projectId = row[0] || '';
      const projectName = row[7] || ''; // Column H
      const activitySeq = String(row[4] || ''); // Column E
      const activityDesc = row[11] || ''; // Column L
      const hours = parseFloat(row[18]) || 0; // Column S - Internal Quantity
      const cost = parseFloat(row[24]) || 0; // Column Y
      const revenue = parseFloat(row[33]) || 0; // Column AH

      const month = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      processedData.push({
        date: dateObj,
        projectId,
        projectName,
        activitySeq,
        activityDescription: activityDesc,
        hours,
        cost,
        revenue,
        month,
        year: dateObj.getFullYear()
      });

      // Collect unique values
      if (projectId) projectSet.set(projectId, projectName);
      if (activitySeq && activitySeq !== '0') activitySet.set(activitySeq, activityDesc);
      periodSet.add(month);
    }

    setHoursData(processedData);
    setProjects(Array.from(projectSet.entries()).map(([id, name]) => ({ id, name })));
    setActivities(Array.from(activitySet.entries()).map(([seq, description]) => ({ seq, description })));
    setPeriods(Array.from(periodSet).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    }));
  }, [data]);

  // Filter and aggregate data
  const filteredData = useMemo(() => {
    let filtered = [...hoursData];

    if (selectedProject !== 'all') {
      filtered = filtered.filter(d => d.projectId === selectedProject);
    }

    if (selectedActivity !== 'all') {
      filtered = filtered.filter(d => d.activitySeq === selectedActivity);
    }

    if (selectedPeriod !== 'all') {
      filtered = filtered.filter(d => d.month === selectedPeriod);
    }

    return filtered;
  }, [hoursData, selectedProject, selectedActivity, selectedPeriod]);

  // Aggregate data by view mode
  const aggregatedData = useMemo(() => {
    const grouped = new Map<string, any>();

    filteredData.forEach(item => {
      let key: string;
      
      switch (viewMode) {
        case 'daily':
          key = item.date.toLocaleDateString();
          break;
        case 'weekly':
          const weekStart = new Date(item.date);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          key = weekStart.toLocaleDateString();
          break;
        case 'monthly':
        default:
          key = item.month;
          break;
      }

      const existing = grouped.get(key) || {
        period: key,
        totalHours: 0,
        totalCost: 0,
        totalRevenue: 0,
        entries: 0,
        projects: new Set(),
        activities: new Set()
      };

      existing.totalHours += item.hours;
      existing.totalCost += item.cost;
      existing.totalRevenue += item.revenue;
      existing.entries += 1;
      existing.projects.add(item.projectId);
      existing.activities.add(item.activitySeq);

      grouped.set(key, existing);
    });

    return Array.from(grouped.values()).map(item => ({
      ...item,
      projectCount: item.projects.size,
      activityCount: item.activities.size,
      avgHoursPerEntry: item.totalHours / item.entries
    })).sort((a, b) => {
      const dateA = new Date(a.period);
      const dateB = new Date(b.period);
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredData, viewMode]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredData.reduce((acc, item) => ({
      hours: acc.hours + item.hours,
      cost: acc.cost + item.cost,
      revenue: acc.revenue + item.revenue,
      entries: acc.entries + 1
    }), { hours: 0, cost: 0, revenue: 0, entries: 0 });
  }, [filteredData]);

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
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '20px'
        }}>
          ⏱️ Hours Tracking & Analysis
        </h1>

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
              fontWeight: '500',
              color: '#374151'
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
                fontSize: '14px',
                backgroundColor: 'white'
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
              fontWeight: '500',
              color: '#374151'
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
                fontSize: '14px',
                backgroundColor: 'white'
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

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              Time Period
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="all">All Periods</option>
              {periods.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              View Mode
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
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
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            borderLeft: '4px solid #3b82f6'
          }}>
            <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '5px' }}>
              TOTAL HOURS
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>
              {totals.hours.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </div>
            <div style={{ fontSize: '12px', color: '#1e3a8a' }}>
              Across {totals.entries} entries
            </div>
          </div>

          <div style={{
            padding: '15px',
            backgroundColor: '#dcfce7',
            borderRadius: '8px',
            borderLeft: '4px solid #22c55e'
          }}>
            <div style={{ fontSize: '12px', color: '#166534', marginBottom: '5px' }}>
              TOTAL COST
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>
              ${totals.cost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '12px', color: '#14532d' }}>
              Internal costs
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
              ${totals.revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '12px', color: '#78350f' }}>
              Sales amount
            </div>
          </div>

          <div style={{
            padding: '15px',
            backgroundColor: '#f3e8ff',
            borderRadius: '8px',
            borderLeft: '4px solid #9333ea'
          }}>
            <div style={{ fontSize: '12px', color: '#6b21a8', marginBottom: '5px' }}>
              AVG HOURS/ENTRY
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#9333ea' }}>
              {totals.entries > 0 ? (totals.hours / totals.entries).toFixed(1) : '0'}
            </div>
            <div style={{ fontSize: '12px', color: '#581c87' }}>
              Per transaction
            </div>
          </div>
        </div>

        {/* Data Table */}
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
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  Period
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Hours
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Cost
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Revenue
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Margin
                </th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>
                  Projects
                </th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>
                  Activities
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                  Avg Hours
                </th>
              </tr>
            </thead>
            <tbody>
              {aggregatedData.map((row, index) => {
                const margin = row.totalRevenue - row.totalCost;
                const marginPercent = row.totalRevenue > 0 ? (margin / row.totalRevenue) * 100 : 0;
                
                return (
                  <tr 
                    key={row.period}
                    style={{
                      backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                    }}
                  >
                    <td style={{ 
                      padding: '12px',
                      fontWeight: '500'
                    }}>
                      {row.period}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {row.totalHours.toFixed(1)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      ${row.totalCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      ${row.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ 
                      padding: '12px', 
                      textAlign: 'right',
                      color: margin >= 0 ? '#059669' : '#dc2626',
                      fontWeight: '600'
                    }}>
                      ${margin.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      <span style={{ 
                        fontSize: '12px', 
                        marginLeft: '5px',
                        opacity: 0.8 
                      }}>
                        ({marginPercent.toFixed(1)}%)
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        backgroundColor: '#e0e7ff',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {row.projectCount}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        backgroundColor: '#fce7f3',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {row.activityCount}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {row.avgHoursPerEntry.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {aggregatedData.length > 0 && (
              <tfoot>
                <tr style={{ 
                  borderTop: '2px solid #e5e7eb',
                  backgroundColor: '#f3f4f6',
                  fontWeight: '600'
                }}>
                  <td style={{ padding: '12px' }}>TOTAL</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {totals.hours.toFixed(1)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ${totals.cost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ${totals.revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    textAlign: 'right',
                    color: (totals.revenue - totals.cost) >= 0 ? '#059669' : '#dc2626'
                  }}>
                    ${(totals.revenue - totals.cost).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td colSpan={3} style={{ padding: '12px' }}></td>
                </tr>
              </tfoot>
            )}
          </table>
          
          {aggregatedData.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
              <div style={{ fontSize: '18px', fontWeight: '500' }}>
                No data available for selected filters
              </div>
              <div style={{ fontSize: '14px', marginTop: '5px' }}>
                Try adjusting your filter criteria
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HoursTracking;