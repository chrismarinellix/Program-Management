import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ProjectSummary {
  projectName: string;
  totalTransactions: number;
  totalAmount: number;
  employees: Set<string>;
  dateRange: { start: Date | null; end: Date | null };
  customers: Set<string>;
}

function ProjectAnalyzer() {
  const [status, setStatus] = useState('Ready to analyze PT.xlsx');
  const [rawData, setRawData] = useState<any>(null);
  const [projects, setProjects] = useState<Map<string, ProjectSummary>>(new Map());
  const [employees, setEmployees] = useState<Map<string, number>>(new Map());
  const [customers, setCustomers] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [filterEmployee, setFilterEmployee] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: null as Date | null, end: null as Date | null });

  const handleLoadExcel = async () => {
    try {
      setLoading(true);
      setStatus('Loading PT.xlsx...');
      const filePath = '/Users/chris/Downloads/PT.xlsx';
      
      const data = await invoke('read_excel', { filePath });
      setRawData(data);
      
      // Process the data
      processProjectData(data as any[]);
      
      setStatus('Analysis complete!');
      setLoading(false);
    } catch (error: any) {
      console.error('Error:', error);
      setStatus(`Error: ${error?.message || error}`);
      setLoading(false);
    }
  };

  const processProjectData = (data: any[]) => {
    if (!data || data.length === 0) return;
    
    const sheet = data[0];
    if (!sheet.rows || sheet.rows.length === 0) {
      setStatus('No data rows found in Excel file');
      return;
    }

    // Find column indices
    const headers = sheet.headers;
    const indices = {
      project: headers.findIndex((h: string) => h === 'Project'),
      projectDesc: headers.findIndex((h: string) => h === 'Project Description'),
      employee: headers.findIndex((h: string) => h === 'Employee'),
      employeeDesc: headers.findIndex((h: string) => h === 'Employee Description'),
      customer: headers.findIndex((h: string) => h === 'Customer Name'),
      date: headers.findIndex((h: string) => h === 'Account Date'),
      internalPrice: headers.findIndex((h: string) => h === 'Total Internal Price'),
      salesAmount: headers.findIndex((h: string) => h === 'Sales Amount'),
      activity: headers.findIndex((h: string) => h === 'Activity Description'),
      subProject: headers.findIndex((h: string) => h === 'Sub Project Description'),
      invoiceStatus: headers.findIndex((h: string) => h === 'Invoice Status'),
    };

    console.log('Column indices found:', indices);
    console.log('Sample first row data:', {
      project: sheet.rows[0]?.[indices.project],
      employee: sheet.rows[0]?.[indices.employee],
      employeeDesc: sheet.rows[0]?.[indices.employeeDesc],
      date: sheet.rows[0]?.[indices.date],
      amount: sheet.rows[0]?.[indices.salesAmount]
    });

    const projectMap = new Map<string, ProjectSummary>();
    const employeeCount = new Map<string, number>();
    const customerCount = new Map<string, number>();
    let overallDateRange = { start: null as Date | null, end: null as Date | null };

    // Process each row
    sheet.rows.forEach((row: any[], rowIndex: number) => {
      // Skip header row if it exists
      if (rowIndex === 0 && row[0] === 'Invoiced') return;
      
      // Skip empty rows
      if (!row || row.every((cell: any) => !cell)) return;

      // Handle both typed and untyped cell formats
      const getCellValue = (cell: any) => {
        if (!cell) return '';
        if (typeof cell === 'string') return cell;
        if (typeof cell === 'number') return cell;
        if (cell.Text !== undefined) return cell.Text;
        if (cell.Number !== undefined) return cell.Number;
        if (cell.DateTime !== undefined) return cell.DateTime;
        return cell;
      };

      const projectName = getCellValue(row[indices.project]) || 'Unknown Project';
      const projectDesc = getCellValue(row[indices.projectDesc]) || '';
      const employee = getCellValue(row[indices.employee]) || '';
      const employeeDesc = getCellValue(row[indices.employeeDesc]) || '';
      const customer = getCellValue(row[indices.customer]) || '';
      const dateStr = getCellValue(row[indices.date]);
      const amount = Number(getCellValue(row[indices.salesAmount])) || Number(getCellValue(row[indices.internalPrice])) || 0;

      // Update project summary
      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, {
          projectName: projectDesc || projectName,
          totalTransactions: 0,
          totalAmount: 0,
          employees: new Set(),
          dateRange: { start: null, end: null },
          customers: new Set()
        });
      }

      const project = projectMap.get(projectName)!;
      project.totalTransactions++;
      project.totalAmount += amount;
      
      if (employee && employee !== '-') {
        project.employees.add(employeeDesc || employee);
        employeeCount.set(employeeDesc || employee, (employeeCount.get(employeeDesc || employee) || 0) + 1);
      }
      
      if (customer && customer !== '-') {
        project.customers.add(customer);
        customerCount.set(customer, (customerCount.get(customer) || 0) + 1);
      }

      // Update date ranges
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          if (!project.dateRange.start || date < project.dateRange.start) {
            project.dateRange.start = date;
          }
          if (!project.dateRange.end || date > project.dateRange.end) {
            project.dateRange.end = date;
          }
          if (!overallDateRange.start || date < overallDateRange.start) {
            overallDateRange.start = date;
          }
          if (!overallDateRange.end || date > overallDateRange.end) {
            overallDateRange.end = date;
          }
        }
      }
    });

    setProjects(projectMap);
    setEmployees(employeeCount);
    setCustomers(customerCount);
    setDateRange(overallDateRange);
    
    console.log(`Processed ${projectMap.size} projects, ${employeeCount.size} employees, ${customerCount.size} customers`);
  };

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

  // Filter projects based on selection
  const filteredProjects = Array.from(projects.entries()).filter(([name, project]) => {
    if (selectedProject && !project.projectName.toLowerCase().includes(selectedProject.toLowerCase())) {
      return false;
    }
    if (filterEmployee && !Array.from(project.employees).some(e => 
      e.toLowerCase().includes(filterEmployee.toLowerCase())
    )) {
      return false;
    }
    return true;
  });

  // Calculate totals
  const totals = {
    projects: projects.size,
    transactions: Array.from(projects.values()).reduce((sum, p) => sum + p.totalTransactions, 0),
    amount: Array.from(projects.values()).reduce((sum, p) => sum + p.totalAmount, 0),
    employees: employees.size,
    customers: customers.size
  };

  // Get top items
  const topProjects = Array.from(projects.entries())
    .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
    .slice(0, 5);
  
  const topEmployees = Array.from(employees.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{ padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b', margin: '0 0 10px 0' }}>
          📊 Project Transaction Analyzer
        </h1>
        <p style={{ color: '#64748b', fontSize: '16px' }}>{status}</p>
      </div>

      {/* Load Button */}
      {!loading && projects.size === 0 && (
        <button 
          onClick={handleLoadExcel}
          style={{
            padding: '12px 32px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
        >
          Load PT.xlsx
        </button>
      )}

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
          <p>Analyzing 57,000+ transactions...</p>
        </div>
      )}

      {projects.size > 0 && (
        <>
          {/* Summary Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Total Projects</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>{totals.projects}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Total Amount</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>{formatCurrency(totals.amount)}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Employees</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6' }}>{totals.employees}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Customers</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>{totals.customers}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Date Range</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginBottom: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#1e293b' }}>🔍 Filters</h3>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Filter by project name..."
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  flex: '1',
                  minWidth: '200px'
                }}
              />
              <input
                type="text"
                placeholder="Filter by employee..."
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  flex: '1',
                  minWidth: '200px'
                }}
              />
              <button
                onClick={() => { setSelectedProject(''); setFilterEmployee(''); }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Two Column Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            {/* Top Projects */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#1e293b' }}>💰 Top Projects by Revenue</h3>
              {topProjects.map(([name, project]) => (
                <div key={name} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ fontWeight: '600', color: '#1e293b', flex: 1 }}>{project.projectName}</div>
                    <div style={{ fontWeight: '700', color: '#10b981' }}>{formatCurrency(project.totalAmount)}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {project.totalTransactions} transactions • {project.employees.size} employees
                  </div>
                </div>
              ))}
            </div>

            {/* Top Employees */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#1e293b' }}>👥 Most Active Employees</h3>
              {topEmployees.map(([name, count]) => (
                <div key={name} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '600', color: '#1e293b', flex: 1 }}>{name || 'Unknown'}</div>
                    <div style={{ 
                      padding: '4px 12px', 
                      backgroundColor: '#ede9fe', 
                      color: '#7c3aed',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {count} entries
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Project Details Table */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#1e293b' }}>
              📋 Project Details {filteredProjects.length !== projects.size && `(Showing ${filteredProjects.length} of ${projects.size})`}
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>PROJECT</th>
                    <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>AMOUNT</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>TRANSACTIONS</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>TEAM SIZE</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>CUSTOMERS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.slice(0, 20).map(([name, project]) => (
                    <tr key={name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>{project.projectName}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>
                        {formatCurrency(project.totalAmount)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{project.totalTransactions}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{project.employees.size}</td>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#64748b' }}>
                        {Array.from(project.customers).slice(0, 2).join(', ')}
                        {project.customers.size > 2 && ` +${project.customers.size - 2} more`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ProjectAnalyzer;