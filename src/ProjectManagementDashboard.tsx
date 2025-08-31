import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Project {
  id: string;
  name: string;
  budget: number;
  spent: number;
  margin: number;
  subtasks: SubTask[];
  employees: Map<string, EmployeeWork>;
  startDate: Date | null;
  endDate: Date | null;
  status: 'active' | 'completed' | 'on-hold';
  customer: string;
}

interface SubTask {
  id: string;
  name: string;
  projectId: string;
  budget: number;
  spent: number;
  hoursAllocated: number;
  hoursUsed: number;
  employees: Map<string, TaskEmployee>;
  status: 'not-started' | 'in-progress' | 'completed';
  startDate: Date | null;
  endDate: Date | null;
}

interface TaskEmployee {
  id: string;
  name: string;
  hours: number;
  cost: number;
  activities: Activity[];
}

interface Activity {
  date: Date;
  hours: number;
  description: string;
  cost: number;
}

interface EmployeeWork {
  id: string;
  name: string;
  totalHours: number;
  totalCost: number;
  hourlyRate: number;
  tasks: string[];
}

interface Filters {
  project: string;
  employee: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  customer: string;
  minBudget: number;
  maxBudget: number;
  showOverBudget: boolean;
  showUnderBudget: boolean;
}

function ProjectManagementDashboard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready to load project data');
  const [projects, setProjects] = useState<Map<string, Project>>(new Map());
  const [allEmployees, setAllEmployees] = useState<Map<string, any>>(new Map());
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [activeView, setActiveView] = useState<'overview' | 'project-detail' | 'employee-view' | 'budget-analysis'>('overview');
  const [filters, setFilters] = useState<Filters>({
    project: '',
    employee: '',
    dateFrom: '',
    dateTo: '',
    status: 'all',
    customer: '',
    minBudget: 0,
    maxBudget: Infinity,
    showOverBudget: false,
    showUnderBudget: false
  });

  const loadAllData = async () => {
    setLoading(true);
    setStatus('Loading all project files...');
    
    try {
      // Load all three files
      const [projectsData, transactionsData, employeesData] = await Promise.all([
        invoke('read_excel', { filePath: '/Users/chris/Downloads/P.xlsx' }),
        invoke('read_excel', { filePath: '/Users/chris/Downloads/PT.xlsx' }),
        invoke('read_excel', { filePath: '/Users/chris/Downloads/AE.xlsx' })
      ]);

      // Process and link the data
      const processedProjects = processProjectData(
        (projectsData as any[])[0],
        (transactionsData as any[])[0],
        (employeesData as any[])[0]
      );

      setProjects(processedProjects.projects);
      setAllEmployees(processedProjects.employees);
      
      setStatus('All data loaded and processed successfully!');
      setLoading(false);
    } catch (error: any) {
      console.error('Error loading data:', error);
      setStatus(`Error: ${error?.message || error}`);
      setLoading(false);
    }
  };

  const processProjectData = (projectSheet: any, transactionSheet: any, employeeSheet: any) => {
    const projects = new Map<string, Project>();
    const employees = new Map<string, any>();
    
    // Helper to get cell value
    const getCellValue = (cell: any): any => {
      if (!cell) return '';
      if (typeof cell === 'string' || typeof cell === 'number') return cell;
      if (cell.Text !== undefined) return cell.Text;
      if (cell.Number !== undefined) return cell.Number;
      if (cell.DateTime !== undefined) return new Date(cell.DateTime);
      return cell;
    };

    // Process employees first
    if (employeeSheet?.rows) {
      employeeSheet.rows.forEach((row: any[]) => {
        const empId = getCellValue(row[1]); // Employee ID
        const empName = getCellValue(row[2]); // Employee Name/Description
        const hourlyRate = Number(getCellValue(row[18])) || 150; // Default rate if not found
        
        if (empId) {
          employees.set(empId, {
            id: empId,
            name: empName || `Employee ${empId}`,
            hourlyRate: hourlyRate,
            totalHours: 0,
            totalCost: 0,
            projects: new Set<string>()
          });
        }
      });
    }

    // Process projects
    if (projectSheet?.rows) {
      const headers = projectSheet.headers;
      const projectIndex = headers.findIndex((h: string) => h.toLowerCase().includes('project'));
      const budgetIndex = headers.findIndex((h: string) => h.toLowerCase().includes('budget'));
      const customerIndex = headers.findIndex((h: string) => h.toLowerCase().includes('customer') || h.toLowerCase().includes('client'));

      projectSheet.rows.forEach((row: any[]) => {
        const projectId = getCellValue(row[projectIndex]);
        const projectName = getCellValue(row[projectIndex + 1]) || projectId; // Assume name is next column
        const budget = Number(getCellValue(row[budgetIndex])) || 100000; // Default budget
        const customer = getCellValue(row[customerIndex]) || 'Unknown Customer';

        if (projectId) {
          projects.set(projectId, {
            id: projectId,
            name: projectName,
            budget: budget,
            spent: 0,
            margin: 0,
            subtasks: [],
            employees: new Map(),
            startDate: null,
            endDate: null,
            status: 'active',
            customer: customer
          });
        }
      });
    }

    // Process transactions and create subtasks
    if (transactionSheet?.rows) {
      const headers = transactionSheet.headers;
      
      // Find column indices
      const indices = {
        project: headers.findIndex((h: string) => h === 'Project'),
        subProject: headers.findIndex((h: string) => h === 'Sub Project'),
        subProjectDesc: headers.findIndex((h: string) => h === 'Sub Project Description'),
        activity: headers.findIndex((h: string) => h === 'Activity'),
        activityDesc: headers.findIndex((h: string) => h === 'Activity Description'),
        employee: headers.findIndex((h: string) => h === 'Employee'),
        employeeDesc: headers.findIndex((h: string) => h === 'Employee Description'),
        date: headers.findIndex((h: string) => h === 'Account Date'),
        internalQuantity: headers.findIndex((h: string) => h === 'Internal Quantity'),
        internalPrice: headers.findIndex((h: string) => h === 'Total Internal Price'),
        salesAmount: headers.findIndex((h: string) => h === 'Sales Amount'),
        customer: headers.findIndex((h: string) => h === 'Customer Name')
      };

      // Group transactions by project and subtask
      const subtaskMap = new Map<string, SubTask>();

      transactionSheet.rows.forEach((row: any[], rowIndex: number) => {
        if (rowIndex === 0 && row[0] === 'Invoiced') return; // Skip header
        
        const projectId = getCellValue(row[indices.project]);
        const subProjectId = getCellValue(row[indices.subProject]);
        const subProjectName = getCellValue(row[indices.subProjectDesc]) || subProjectId || 'Main Task';
        const employeeId = getCellValue(row[indices.employee]);
        const employeeName = getCellValue(row[indices.employeeDesc]) || employeeId;
        const activityDesc = getCellValue(row[indices.activityDesc]) || '';
        const dateValue = getCellValue(row[indices.date]);
        const hours = Number(getCellValue(row[indices.internalQuantity])) || 0;
        const cost = Number(getCellValue(row[indices.internalPrice])) || 0;
        const salesAmount = Number(getCellValue(row[indices.salesAmount])) || 0;

        if (!projectId || projectId === 'Unknown Project') return;

        const project = projects.get(projectId);
        if (!project) return;

        // Create or update subtask
        const subtaskKey = `${projectId}:${subProjectId || 'main'}`;
        if (!subtaskMap.has(subtaskKey)) {
          const newSubtask: SubTask = {
            id: subProjectId || 'main',
            name: subProjectName,
            projectId: projectId,
            budget: project.budget * 0.2, // Allocate 20% of project budget by default
            spent: 0,
            hoursAllocated: 100, // Default allocation
            hoursUsed: 0,
            employees: new Map(),
            status: 'in-progress',
            startDate: null,
            endDate: null
          };
          subtaskMap.set(subtaskKey, newSubtask);
          project.subtasks.push(newSubtask);
        }

        const subtask = subtaskMap.get(subtaskKey)!;
        
        // Update subtask data
        subtask.spent += cost;
        subtask.hoursUsed += hours;

        // Update dates
        if (dateValue) {
          const date = new Date(dateValue);
          if (!subtask.startDate || date < subtask.startDate) {
            subtask.startDate = date;
          }
          if (!subtask.endDate || date > subtask.endDate) {
            subtask.endDate = date;
          }
          if (!project.startDate || date < project.startDate) {
            project.startDate = date;
          }
          if (!project.endDate || date > project.endDate) {
            project.endDate = date;
          }
        }

        // Track employee work on subtask
        if (employeeId) {
          if (!subtask.employees.has(employeeId)) {
            subtask.employees.set(employeeId, {
              id: employeeId,
              name: employeeName || `Employee ${employeeId}`,
              hours: 0,
              cost: 0,
              activities: []
            });
          }

          const taskEmployee = subtask.employees.get(employeeId)!;
          taskEmployee.hours += hours;
          taskEmployee.cost += cost;
          taskEmployee.activities.push({
            date: dateValue ? new Date(dateValue) : new Date(),
            hours: hours,
            description: activityDesc,
            cost: cost
          });

          // Update project-level employee tracking
          if (!project.employees.has(employeeId)) {
            const emp = employees.get(employeeId);
            project.employees.set(employeeId, {
              id: employeeId,
              name: employeeName || emp?.name || `Employee ${employeeId}`,
              totalHours: 0,
              totalCost: 0,
              hourlyRate: emp?.hourlyRate || 150,
              tasks: []
            });
          }

          const projectEmployee = project.employees.get(employeeId)!;
          projectEmployee.totalHours += hours;
          projectEmployee.totalCost += cost;
          if (!projectEmployee.tasks.includes(subtask.name)) {
            projectEmployee.tasks.push(subtask.name);
          }
        }

        // Update project totals
        project.spent += cost;
      });

      // Calculate margins and status for all projects
      projects.forEach(project => {
        project.margin = project.budget - project.spent;
        
        // Determine project status
        if (project.margin < 0) {
          project.status = 'on-hold'; // Over budget
        } else if (project.spent / project.budget > 0.9) {
          project.status = 'completed'; // Near completion
        }

        // Update subtask statuses
        project.subtasks.forEach(subtask => {
          const budgetUsage = subtask.spent / subtask.budget;
          if (budgetUsage >= 1) {
            subtask.status = 'completed';
          } else if (budgetUsage > 0) {
            subtask.status = 'in-progress';
          }
        });
      });
    }

    return { projects, employees };
  };

  // Filter projects based on current filters
  const filteredProjects = useMemo(() => {
    let filtered = Array.from(projects.entries());

    // Apply filters
    if (filters.project) {
      filtered = filtered.filter(([id, p]) => 
        p.name.toLowerCase().includes(filters.project.toLowerCase()) ||
        id.toLowerCase().includes(filters.project.toLowerCase())
      );
    }

    if (filters.employee) {
      filtered = filtered.filter(([id, p]) => 
        Array.from(p.employees.values()).some(e => 
          e.name.toLowerCase().includes(filters.employee.toLowerCase())
        )
      );
    }

    if (filters.customer) {
      filtered = filtered.filter(([id, p]) => 
        p.customer.toLowerCase().includes(filters.customer.toLowerCase())
      );
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(([id, p]) => p.status === filters.status);
    }

    if (filters.showOverBudget) {
      filtered = filtered.filter(([id, p]) => p.margin < 0);
    }

    if (filters.showUnderBudget) {
      filtered = filtered.filter(([id, p]) => p.margin > 0 && p.spent / p.budget < 0.5);
    }

    filtered = filtered.filter(([id, p]) => 
      p.budget >= filters.minBudget && p.budget <= filters.maxBudget
    );

    return filtered;
  }, [projects, filters]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in-progress': return '#3b82f6';
      case 'not-started': return '#6b7280';
      case 'on-hold': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getMarginColor = (margin: number, budget: number) => {
    const percentage = (margin / budget) * 100;
    if (margin < 0) return '#ef4444'; // Over budget - red
    if (percentage < 10) return '#f59e0b'; // Low margin - yellow
    if (percentage < 30) return '#3b82f6'; // OK margin - blue
    return '#10b981'; // Good margin - green
  };

  const renderProjectDetail = (project: Project) => {
    return (
      <div style={{ padding: '20px' }}>
        {/* Project Header */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '30px', 
          borderRadius: '12px', 
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '28px' }}>{project.name}</h2>
              <p style={{ color: '#6b7280', margin: '0' }}>Customer: {project.customer}</p>
              <p style={{ color: '#6b7280', margin: '5px 0' }}>
                {formatDate(project.startDate)} - {formatDate(project.endDate)}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ 
                padding: '6px 12px', 
                backgroundColor: getStatusColor(project.status) + '20',
                color: getStatusColor(project.status),
                borderRadius: '6px',
                display: 'inline-block',
                fontWeight: '600',
                marginBottom: '10px'
              }}>
                {project.status.toUpperCase()}
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: getMarginColor(project.margin, project.budget) }}>
                {formatCurrency(project.margin)}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Margin Remaining</div>
            </div>
          </div>

          {/* Budget Overview */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '20px',
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Total Budget</div>
              <div style={{ fontSize: '20px', fontWeight: '600' }}>{formatCurrency(project.budget)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Spent</div>
              <div style={{ fontSize: '20px', fontWeight: '600', color: '#ef4444' }}>{formatCurrency(project.spent)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>% Used</div>
              <div style={{ fontSize: '20px', fontWeight: '600' }}>
                {((project.spent / project.budget) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Team Size</div>
              <div style={{ fontSize: '20px', fontWeight: '600' }}>{project.employees.size} people</div>
            </div>
          </div>

          {/* Budget Progress Bar */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ 
              width: '100%', 
              height: '20px', 
              backgroundColor: '#e5e7eb',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${Math.min((project.spent / project.budget) * 100, 100)}%`,
                height: '100%',
                backgroundColor: getMarginColor(project.margin, project.budget),
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </div>

        {/* Subtasks Section */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '30px', 
          borderRadius: '12px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 20px 0' }}>📋 Subtasks & Activities</h3>
          
          {project.subtasks.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No subtasks found</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#6b7280' }}>TASK</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>STATUS</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: '#6b7280' }}>BUDGET</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: '#6b7280' }}>SPENT</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: '#6b7280' }}>REMAINING</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>HOURS</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>TEAM</th>
                  </tr>
                </thead>
                <tbody>
                  {project.subtasks.map(subtask => (
                    <React.Fragment key={subtask.id}>
                      <tr style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                          onClick={() => console.log('Expand subtask:', subtask.id)}>
                        <td style={{ padding: '12px', fontWeight: '500' }}>{subtask.name}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ 
                            padding: '4px 8px',
                            backgroundColor: getStatusColor(subtask.status) + '20',
                            color: getStatusColor(subtask.status),
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {subtask.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(subtask.budget)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>{formatCurrency(subtask.spent)}</td>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right',
                          color: getMarginColor(subtask.budget - subtask.spent, subtask.budget),
                          fontWeight: '600'
                        }}>
                          {formatCurrency(subtask.budget - subtask.spent)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {subtask.hoursUsed.toFixed(1)} / {subtask.hoursAllocated}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{subtask.employees.size}</td>
                      </tr>
                      
                      {/* Employee breakdown for this subtask */}
                      {Array.from(subtask.employees.values()).map(emp => (
                        <tr key={`${subtask.id}-${emp.id}`} style={{ backgroundColor: '#f8fafc' }}>
                          <td colSpan={2} style={{ padding: '8px 12px 8px 40px', fontSize: '13px' }}>
                            ↳ {emp.name}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px' }}></td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px' }}>
                            {formatCurrency(emp.cost)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px' }}></td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px' }}>
                            {emp.hours.toFixed(1)} hrs
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px' }}>
                            {emp.activities.length} activities
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Team Overview */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '30px', 
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 20px 0' }}>👥 Team & Hours Breakdown</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {Array.from(project.employees.values()).map(emp => (
              <div key={emp.id} style={{ 
                padding: '15px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#fafafa'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '10px' }}>{emp.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#6b7280' }}>Total Hours:</span>
                    <strong style={{ marginLeft: '5px' }}>{emp.totalHours.toFixed(1)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Total Cost:</span>
                    <strong style={{ marginLeft: '5px' }}>{formatCurrency(emp.totalCost)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Rate:</span>
                    <strong style={{ marginLeft: '5px' }}>${emp.hourlyRate}/hr</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Tasks:</span>
                    <strong style={{ marginLeft: '5px' }}>{emp.tasks.length}</strong>
                  </div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
                  Working on: {emp.tasks.slice(0, 2).join(', ')}
                  {emp.tasks.length > 2 && ` +${emp.tasks.length - 2} more`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f1f5f9',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        padding: '20px'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px 0' }}>
            📊 Project Management Dashboard
          </h1>
          <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>{status}</p>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
        {/* Load Button */}
        {!loading && projects.size === 0 && (
          <button 
            onClick={loadAllData}
            style={{
              padding: '14px 40px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
            }}
          >
            Load Project Data (P, PT, AE)
          </button>
        )}

        {loading && (
          <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'white', borderRadius: '12px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <h3>Loading Project Data...</h3>
            <p style={{ color: '#64748b' }}>Processing projects, transactions, and employees</p>
          </div>
        )}

        {projects.size > 0 && (
          <>
            {/* Filters Bar */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '12px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ marginBottom: '15px', fontWeight: '600' }}>🔍 Filters & Search</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={filters.project}
                  onChange={(e) => setFilters({...filters, project: e.target.value})}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={filters.employee}
                  onChange={(e) => setFilters({...filters, employee: e.target.value})}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on-hold">On Hold</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={filters.showOverBudget}
                    onChange={(e) => setFilters({...filters, showOverBudget: e.target.checked})}
                  />
                  Over Budget Only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={filters.showUnderBudget}
                    onChange={(e) => setFilters({...filters, showUnderBudget: e.target.checked})}
                  />
                  Under 50% Budget
                </label>
              </div>
            </div>

            {/* Main Content Area */}
            {selectedProject ? (
              <>
                <button
                  onClick={() => setSelectedProject('')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginBottom: '20px'
                  }}
                >
                  ← Back to Projects
                </button>
                {renderProjectDetail(projects.get(selectedProject)!)}
              </>
            ) : (
              /* Projects Grid */
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
                gap: '20px'
              }}>
                {filteredProjects.map(([id, project]) => (
                  <div 
                    key={id}
                    onClick={() => setSelectedProject(id)}
                    style={{ 
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      border: '2px solid transparent'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{project.name}</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{project.customer}</p>
                      </div>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: getStatusColor(project.status) + '20',
                        color: getStatusColor(project.status),
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {project.status}
                      </span>
                    </div>

                    {/* Budget Progress */}
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                        <span>Budget Used</span>
                        <span>{((project.spent / project.budget) * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: '8px', 
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          width: `${Math.min((project.spent / project.budget) * 100, 100)}%`,
                          height: '100%',
                          backgroundColor: getMarginColor(project.margin, project.budget)
                        }} />
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: '#6b7280' }}>Budget:</span>
                        <strong style={{ marginLeft: '5px' }}>{formatCurrency(project.budget)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Spent:</span>
                        <strong style={{ marginLeft: '5px', color: '#ef4444' }}>{formatCurrency(project.spent)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Margin:</span>
                        <strong style={{ 
                          marginLeft: '5px',
                          color: getMarginColor(project.margin, project.budget)
                        }}>
                          {formatCurrency(project.margin)}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Team:</span>
                        <strong style={{ marginLeft: '5px' }}>{project.employees.size} people</strong>
                      </div>
                    </div>

                    {/* Subtasks Summary */}
                    <div style={{ 
                      marginTop: '15px', 
                      paddingTop: '15px', 
                      borderTop: '1px solid #e5e7eb',
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      {project.subtasks.length} subtasks • 
                      {project.subtasks.filter(s => s.status === 'completed').length} completed •
                      {project.subtasks.filter(s => s.status === 'in-progress').length} in progress
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ProjectManagementDashboard;