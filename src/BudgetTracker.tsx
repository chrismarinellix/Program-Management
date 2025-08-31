import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Tooltip from './Tooltip';

interface BudgetData {
  activitySeq: string;
  project: string;
  projectDescription: string;
  activity: string;
  activityDescription: string;
  budgetHours: number;
  budgetCost: number;
  budgetRevenue: number;
  actualHours: number;
  actualCost: number;
  actualRevenue: number;
  remainingBudget: number;
  hoursUsedPercent: number;
  costUsedPercent: number;
  revenueUsedPercent: number;
  status: 'on-track' | 'warning' | 'over-budget';
}

interface Props {
  aeData: any[];
  ptData: any[];
  pData: any[];
}

const BudgetTracker: React.FC<Props> = ({ aeData, ptData, pData }) => {
  const [budgetSummary, setBudgetSummary] = useState<BudgetData[]>([]);
  const [filter, setFilter] = useState('');
  const [sortField, setSortField] = useState<keyof BudgetData>('activitySeq');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showOnlyOverBudget, setShowOnlyOverBudget] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [showTooltips, setShowTooltips] = useState(true);

  // Listen for settings updates
  useEffect(() => {
    const handleSettingsUpdate = (event: CustomEvent) => {
      if (event.detail.showTooltips !== undefined) {
        setShowTooltips(event.detail.showTooltips);
      }
    };
    
    window.addEventListener('settingsUpdated', handleSettingsUpdate as EventListener);
    
    // Load initial settings
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setShowTooltips(settings.showTooltips ?? true);
    }
    
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate as EventListener);
    };
  }, []);

  // Aggregate PT data by Activity Seq
  const aggregatePTData = (ptData: any[]) => {
    const aggregated: { [key: string]: { hours: number; cost: number; revenue: number; count: number } } = {};
    
    ptData.forEach((row) => {
      // Skip header rows
      if (typeof row[5] !== 'number' && typeof row[5] !== 'string') return;
      
      const activitySeq = String(row[5] || '').replace('.00', '');
      if (!activitySeq || activitySeq === 'Activity Seq') return;
      
      if (!aggregated[activitySeq]) {
        aggregated[activitySeq] = { hours: 0, cost: 0, revenue: 0, count: 0 };
      }
      
      // Column S (index 18): Internal Quantity (hours)
      // Column Y (index 24): Internal Amount (cost)
      // Column AI (index 34): Sales Amount (revenue)
      
      const hours = parseFloat(row[18]) || 0;
      const cost = parseFloat(row[24]) || 0;
      const revenue = parseFloat(row[34]) || 0;
      
      aggregated[activitySeq].hours += hours;
      aggregated[activitySeq].cost += cost;
      aggregated[activitySeq].revenue += revenue;
      aggregated[activitySeq].count += 1;
    });
    
    return aggregated;
  };

  // Process and calculate budget data
  useEffect(() => {
    if (!aeData.length || !ptData.length) return;
    
    console.log('AE Data sample:', aeData.slice(0, 3));
    console.log('PT Data sample:', ptData.slice(0, 3));
    
    const ptAggregated = aggregatePTData(ptData);
    
    const budgetData: BudgetData[] = aeData
      .filter((row, index) => {
        // Skip first row (headers) and empty activity sequences
        if (index === 0) return false;
        const activitySeq = row[18]; // Column S
        return activitySeq && 
               (typeof activitySeq === 'number' || 
                (typeof activitySeq === 'string' && !isNaN(parseFloat(activitySeq)))) && 
               parseFloat(String(activitySeq)) > 0;
      })
      .map((aeRow) => {
        const activitySeq = String(aeRow[18]).replace('.00', ''); // Column S
        const project = String(aeRow[1] || ''); // Column B
        const projectDesc = String(aeRow[2] || ''); // Column C
        const activity = String(aeRow[5] || ''); // Column F
        const activityDesc = String(aeRow[6] || ''); // Column G
        
        // Budget data from AE
        const budgetCost = parseFloat(String(aeRow[10])) || 0; // Column K
        const budgetRevenue = parseFloat(String(aeRow[11])) || 0; // Column L
        const budgetHours = parseFloat(String(aeRow[12])) || 0; // Column M
        
        // Actual data from aggregated PT
        const actuals = ptAggregated[activitySeq] || { hours: 0, cost: 0, revenue: 0, count: 0 };
        
        // Calculations
        const remainingBudget = budgetRevenue - actuals.revenue;
        const hoursUsedPercent = budgetHours > 0 ? (actuals.hours / budgetHours) * 100 : 0;
        const costUsedPercent = budgetCost > 0 ? (actuals.cost / budgetCost) * 100 : 0;
        const revenueUsedPercent = budgetRevenue > 0 ? (actuals.revenue / budgetRevenue) * 100 : 0;
        
        // Determine status
        let status: 'on-track' | 'warning' | 'over-budget' = 'on-track';
        if (revenueUsedPercent > 100 || costUsedPercent > 100) {
          status = 'over-budget';
        } else if (revenueUsedPercent > 80 || costUsedPercent > 80) {
          status = 'warning';
        }
        
        return {
          activitySeq,
          project,
          projectDescription: projectDesc,
          activity,
          activityDescription: activityDesc,
          budgetHours,
          budgetCost,
          budgetRevenue,
          actualHours: actuals.hours,
          actualCost: actuals.cost,
          actualRevenue: actuals.revenue,
          remainingBudget,
          hoursUsedPercent,
          costUsedPercent,
          revenueUsedPercent,
          status
        };
      })
      .filter(item => item.budgetRevenue > 0 || item.actualRevenue > 0); // Only show items with budget or actuals
    
    setBudgetSummary(budgetData);
  }, [aeData, ptData]);

  // Get unique projects for filter
  const projects = useMemo(() => {
    const uniqueProjects = new Set(budgetSummary.map(item => item.project));
    return Array.from(uniqueProjects).filter(p => p).sort();
  }, [budgetSummary]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = budgetSummary;
    
    // Apply text filter
    if (filter) {
      filtered = filtered.filter(item =>
        item.activitySeq.toLowerCase().includes(filter.toLowerCase()) ||
        item.activity.toLowerCase().includes(filter.toLowerCase()) ||
        item.activityDescription.toLowerCase().includes(filter.toLowerCase()) ||
        item.project.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    // Apply project filter
    if (selectedProject !== 'all') {
      filtered = filtered.filter(item => item.project === selectedProject);
    }
    
    // Apply over-budget filter
    if (showOnlyOverBudget) {
      filtered = filtered.filter(item => item.status === 'over-budget');
    }
    
    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    
    return filtered;
  }, [budgetSummary, filter, selectedProject, showOnlyOverBudget, sortField, sortDirection]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Activity Seq', 'Project', 'Activity', 'Description',
      'Budget Hours', 'Budget Cost', 'Budget Revenue',
      'Actual Hours', 'Actual Cost', 'Actual Revenue',
      'Remaining Budget', 'Hours Used %', 'Cost Used %', 'Revenue Used %', 'Status'
    ];
    
    const rows = filteredData.map(row => [
      row.activitySeq,
      row.project,
      row.activity,
      row.activityDescription,
      row.budgetHours.toFixed(2),
      row.budgetCost.toFixed(2),
      row.budgetRevenue.toFixed(2),
      row.actualHours.toFixed(2),
      row.actualCost.toFixed(2),
      row.actualRevenue.toFixed(2),
      row.remainingBudget.toFixed(2),
      row.hoursUsedPercent.toFixed(1),
      row.costUsedPercent.toFixed(1),
      row.revenueUsedPercent.toFixed(1),
      row.status
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate totals
  const totals = useMemo(() => {
    return filteredData.reduce((acc, item) => ({
      budgetCost: acc.budgetCost + item.budgetCost,
      budgetRevenue: acc.budgetRevenue + item.budgetRevenue,
      actualCost: acc.actualCost + item.actualCost,
      actualRevenue: acc.actualRevenue + item.actualRevenue,
      remainingBudget: acc.remainingBudget + item.remainingBudget
    }), {
      budgetCost: 0,
      budgetRevenue: 0,
      actualCost: 0,
      actualRevenue: 0,
      remainingBudget: 0
    });
  }, [filteredData]);

  const handleSort = (field: keyof BudgetData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'over-budget': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatPercent = (value: number) => {
    const color = value > 100 ? '#ef4444' : value > 80 ? '#f59e0b' : '#10b981';
    return <span style={{ color, fontWeight: '600' }}>{value.toFixed(1)}%</span>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Progress bar component
  const ProgressBar = ({ percent, color }: { percent: number; color: string }) => (
    <div style={{ 
      width: '100%', 
      height: '6px', 
      backgroundColor: '#e5e7eb', 
      borderRadius: '3px',
      overflow: 'hidden'
    }}>
      <div style={{
        width: `${Math.min(100, percent)}%`,
        height: '100%',
        backgroundColor: color,
        transition: 'width 0.3s ease',
        borderRadius: '3px'
      }} />
    </div>
  );

  return (
    <div style={{ 
      background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header Section with Gradient */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '32px 24px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{ 
            margin: '0 0 8px 0', 
            color: 'white',
            fontSize: '32px',
            fontWeight: '700',
            letterSpacing: '-0.5px'
          }}>
            Budget Tracker
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px', margin: 0 }}>
            Real-time budget monitoring and analysis
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        {/* Summary Cards with Enhanced Design */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '20px', 
          marginBottom: '32px' 
        }}>
          {/* Total Budget Card */}
          <div style={{ 
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px'
              }}>
                <span style={{ color: 'white', fontSize: '20px' }}>💰</span>
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>Total Budget</div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}>
              {formatCurrency(totals.budgetRevenue)}
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
              Allocated across {filteredData.length} activities
            </div>
          </div>

          {/* Total Actual Card */}
          <div style={{ 
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px'
              }}>
                <span style={{ color: 'white', fontSize: '20px' }}>📊</span>
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>Total Spent</div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}>
              {formatCurrency(totals.actualRevenue)}
            </div>
            <ProgressBar 
              percent={(totals.actualRevenue / totals.budgetRevenue) * 100} 
              color={totals.actualRevenue > totals.budgetRevenue ? '#ef4444' : '#3b82f6'} 
            />
          </div>

          {/* Remaining Budget Card */}
          <div style={{ 
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: totals.remainingBudget < 0 
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px'
              }}>
                <span style={{ color: 'white', fontSize: '20px' }}>
                  {totals.remainingBudget < 0 ? '⚠️' : '✅'}
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>Remaining</div>
            </div>
            <div style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: totals.remainingBudget < 0 ? '#ef4444' : '#10b981',
              marginBottom: '4px'
            }}>
              {formatCurrency(totals.remainingBudget)}
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
              {totals.remainingBudget < 0 ? 'Over budget' : 'Within budget'}
            </div>
          </div>

          {/* Overall Usage Card */}
          <div style={{ 
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px'
              }}>
                <span style={{ color: 'white', fontSize: '20px' }}>📈</span>
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>Overall Usage</div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>
              {formatPercent(totals.budgetRevenue > 0 ? (totals.actualRevenue / totals.budgetRevenue) * 100 : 0)}
            </div>
            <ProgressBar 
              percent={totals.budgetRevenue > 0 ? (totals.actualRevenue / totals.budgetRevenue) * 100 : 0} 
              color={
                (totals.actualRevenue / totals.budgetRevenue) * 100 > 100 ? '#ef4444' :
                (totals.actualRevenue / totals.budgetRevenue) * 100 > 80 ? '#f59e0b' : '#10b981'
              } 
            />
          </div>
        </div>
        
        {/* Filters Section with Enhanced Design */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '24px', 
          borderRadius: '16px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', minWidth: '200px' }}>
              <input
                type="text"
                placeholder="🔍 Search activities..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  backgroundColor: '#f9fafb',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.backgroundColor = 'white';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.backgroundColor = '#f9fafb';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '14px',
                backgroundColor: '#f9fafb',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: '180px',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.backgroundColor = 'white';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.backgroundColor = '#f9fafb';
              }}
            >
              <option value="all">All Projects</option>
              {projects.map(project => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
            
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: showOnlyOverBudget ? '#fee2e2' : '#f9fafb',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: '2px solid',
              borderColor: showOnlyOverBudget ? '#fecaca' : '#e5e7eb'
            }}>
              <input
                type="checkbox"
                checked={showOnlyOverBudget}
                onChange={(e) => setShowOnlyOverBudget(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '14px', fontWeight: '500', color: showOnlyOverBudget ? '#dc2626' : '#6b7280' }}>
                Over Budget Only
              </span>
            </label>
            
            <button
              onClick={exportToCSV}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              }}
            >
              <span>📥</span> Export CSV
            </button>
          </div>
        </div>

        {/* Data Table with Enhanced Design */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)' }}>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'left', 
                    borderBottom: '2px solid #e5e7eb',
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onClick={() => handleSort('activitySeq')}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#374151'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}>
                    Activity Seq {sortField === 'activitySeq' && (
                      <span style={{ color: '#667eea', marginLeft: '4px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'left', 
                    borderBottom: '2px solid #e5e7eb',
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Project
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'left', 
                    borderBottom: '2px solid #e5e7eb',
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Activity
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'right', 
                    borderBottom: '2px solid #e5e7eb',
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onClick={() => handleSort('budgetRevenue')}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#374151'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}>
                    Budget {sortField === 'budgetRevenue' && (
                      <span style={{ color: '#667eea', marginLeft: '4px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'right', 
                    borderBottom: '2px solid #e5e7eb',
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onClick={() => handleSort('actualRevenue')}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#374151'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}>
                    Actual {sortField === 'actualRevenue' && (
                      <span style={{ color: '#667eea', marginLeft: '4px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'right', 
                    borderBottom: '2px solid #e5e7eb',
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onClick={() => handleSort('remainingBudget')}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#374151'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}>
                    <Tooltip 
                      content="Remaining Budget = Budget Revenue - Actual Revenue. Shows how much budget is left to spend." 
                      enabled={showTooltips}
                    >
                      <span>Remaining {sortField === 'remainingBudget' && (
                        <span style={{ color: '#667eea', marginLeft: '4px' }}>
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}</span>
                    </Tooltip>
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    borderBottom: '2px solid #e5e7eb',
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onClick={() => handleSort('revenueUsedPercent')}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#374151'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}>
                    <Tooltip 
                      content="Usage % = (Actual Revenue / Budget Revenue) × 100. Shows the percentage of budget consumed." 
                      enabled={showTooltips}
                    >
                      <span>Usage {sortField === 'revenueUsedPercent' && (
                        <span style={{ color: '#667eea', marginLeft: '4px' }}>
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}</span>
                    </Tooltip>
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    borderBottom: '2px solid #e5e7eb',
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, index) => (
                  <tr key={row.activitySeq} 
                      style={{ 
                        backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                        transition: 'background-color 0.2s',
                        cursor: 'default'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#fafafa';
                      }}>
                    <td style={{ 
                      padding: '16px', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontSize: '14px', 
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>
                      {row.activitySeq}
                    </td>
                    <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', fontSize: '14px' }}>
                      <div style={{ fontWeight: '500', color: '#1f2937' }}>{row.project}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                        {row.projectDescription}
                      </div>
                    </td>
                    <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', fontSize: '14px' }}>
                      <div style={{ fontWeight: '500', color: '#1f2937' }}>{row.activity}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                        {row.activityDescription}
                      </div>
                    </td>
                    <td style={{ 
                      padding: '16px', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontSize: '14px', 
                      textAlign: 'right',
                      fontWeight: '500',
                      color: '#1f2937'
                    }}>
                      {formatCurrency(row.budgetRevenue)}
                    </td>
                    <td style={{ 
                      padding: '16px', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontSize: '14px', 
                      textAlign: 'right',
                      fontWeight: '500',
                      color: '#1f2937'
                    }}>
                      {formatCurrency(row.actualRevenue)}
                    </td>
                    <td style={{ 
                      padding: '16px', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontSize: '14px', 
                      textAlign: 'right',
                      color: row.remainingBudget < 0 ? '#ef4444' : '#10b981',
                      fontWeight: '600'
                    }}>
                      {formatCurrency(row.remainingBudget)}
                    </td>
                    <td style={{ 
                      padding: '16px', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontSize: '14px', 
                      textAlign: 'center'
                    }}>
                      <div style={{ marginBottom: '4px' }}>
                        {formatPercent(row.revenueUsedPercent)}
                      </div>
                      <div style={{ width: '80px', margin: '0 auto' }}>
                        <ProgressBar 
                          percent={row.revenueUsedPercent} 
                          color={
                            row.revenueUsedPercent > 100 ? '#ef4444' :
                            row.revenueUsedPercent > 80 ? '#f59e0b' : '#10b981'
                          }
                        />
                      </div>
                    </td>
                    <td style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: 
                          row.status === 'on-track' ? 'rgba(16, 185, 129, 0.1)' :
                          row.status === 'warning' ? 'rgba(245, 158, 11, 0.1)' :
                          'rgba(239, 68, 68, 0.1)',
                        color: getStatusColor(row.status),
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'inline-block'
                      }}>
                        {row.status.replace('-', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetTracker;