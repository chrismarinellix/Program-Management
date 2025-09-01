import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ColumnHeader, DataSourceMapping, ColumnMapping } from './components/DataSourceMapping';

interface Project {
  id: string;
  name: string;
  description: string;
  budget: number;
  actualSpent: number;
  margin: number;
  activities: Activity[];
  employees: Map<string, EmployeeWork>;
  notes: Note[];
  status: string;
  customer: string;
  startDate: Date | null;
  endDate: Date | null;
}

interface Activity {
  id: string;
  projectId: string;
  activitySeq: string;
  activityShortName: string;
  activityDescription: string;
  subProject: string;
  subProjectDescription: string;
  reportCode: string;
  reportCodeDescription: string;
  budget: number;
  spent: number;
  hours: number;
  transactions: Transaction[];
  employees: Map<string, EmployeeActivity>;
}

interface Transaction {
  date: Date;
  employee: string;
  employeeName: string;
  hours: number;
  internalPrice: number;
  salesAmount: number;
  invoiceStatus: string;
  invoiceable: string;
}

interface EmployeeActivity {
  id: string;
  name: string;
  hours: number;
  cost: number;
  transactions: Transaction[];
}

interface EmployeeWork {
  id: string;
  name: string;
  totalHours: number;
  totalCost: number;
  hourlyRate: number;
  activities: string[];
}

interface Note {
  id: string;
  projectId: string;
  activityId?: string;
  text: string;
  author: string;
  timestamp: Date;
  category: 'general' | 'budget' | 'risk' | 'progress';
}

function EnhancedProjectDashboard({ data }: { data?: any }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Processing project data...');
  const [projects, setProjects] = useState<Map<string, Project>>(new Map());
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState<'general' | 'budget' | 'risk' | 'progress'>('general');
  const [currentUser, setCurrentUser] = useState('User'); // In production, get from auth
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [projectNotes, setProjectNotes] = useState<{[key: string]: string}>({});
  const [notesSaveTimeout, setNotesSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showMappingEditor, setShowMappingEditor] = useState<string | null>(null); // Edit mappings
  
  // Define column mappings for project list view
  const [projectListMappings, setProjectListMappings] = useState<{ [key: string]: ColumnMapping }>({
    projectName: { displayName: 'Project Name', source: 'P', column: 'B', editable: true },
    client: { displayName: 'Client', source: 'P', column: 'C', editable: true },
    budget: { displayName: 'Budget', source: 'P', column: 'D', editable: true },
    spent: { displayName: 'Spent', source: 'PT', column: 'Y', editable: true },
    status: { displayName: 'Status', source: 'P', column: 'E', editable: true },
  });
  
  // Define column mappings for project details view
  const [projectDetailMappings, setProjectDetailMappings] = useState<{ [key: string]: ColumnMapping }>({
    totalBudget: { displayName: 'Total Budget', source: 'P', column: 'D', editable: true },
    actualSpent: { displayName: 'Actual Spent', source: 'PT', column: 'Y', editable: true },
    startDate: { displayName: 'Start Date', source: 'P', column: 'F', editable: true },
    endDate: { displayName: 'End Date', source: 'P', column: 'G', editable: true },
  });
  
  // Define column mappings for activity table
  // Note: Activity descriptions come from PT.xlsx transaction data
  const [activityMappings, setActivityMappings] = useState<{ [key: string]: ColumnMapping }>({
    activity: { displayName: 'Activity', source: 'PT', column: 'F', editable: true }, // Activity Description column in PT (corrected)
    subProject: { displayName: 'Sub-Project', source: 'PT', column: 'I', editable: true }, // Sub Project Description column in PT
    activityBudget: { displayName: 'Budget', source: 'AE', column: 'L', editable: true },
    activitySpent: { displayName: 'Spent', source: 'PT', column: 'Y', editable: true }, // Total Internal Price
    hours: { displayName: 'Hours', source: 'PT', column: 'S', editable: true }, // Internal Quantity
  });

  // Process data on mount or when data prop changes
  useEffect(() => {
    if (data?.pData && data?.ptData && data?.aeData) {
      processLoadedData();
    }
  }, [data]);

  // Load notes when a project is selected
  useEffect(() => {
    if (selectedProject) {
      loadProjectNotes(selectedProject);
    }
  }, [selectedProject]);

  const processLoadedData = () => {
    if (!data) return;
    
    setStatus('Processing project data...');
    
    try {
      const processedProjects = processProjectData(
        (data.pData as any[])[0],
        (data.ptData as any[])[0],
        (data.aeData as any[])[0]
      );

      setProjects(processedProjects);
      setStatus(`${processedProjects.size} projects ready`);
      
      // Select first project by default if none selected
      if (processedProjects.size > 0 && !selectedProject) {
        setSelectedProject(Array.from(processedProjects.keys())[0]);
      }
    } catch (error: any) {
      console.error('Error processing data:', error);
      setStatus(`Error: ${error?.message || error}`);
    }
  };

  const processProjectData = (projectSheet: any, transactionSheet: any, employeeSheet: any) => {
    const projects = new Map<string, Project>();
    
    const getCellValue = (cell: any): any => {
      if (!cell) return '';
      if (typeof cell === 'string' || typeof cell === 'number') return cell;
      if (cell.Text !== undefined) return cell.Text;
      if (cell.Number !== undefined) return cell.Number;
      if (cell.DateTime !== undefined) return new Date(cell.DateTime);
      return cell;
    };

    // Process employees first to get rates
    const employeeRates = new Map<string, number>();
    if (employeeSheet?.rows) {
      const headers = employeeSheet.headers;
      const empIdIndex = headers.findIndex((h: string) => h.toLowerCase().includes('employee'));
      const rateIndex = headers.findIndex((h: string) => h.toLowerCase().includes('rate') || h.toLowerCase().includes('cost'));
      const statusIndex = headers.findIndex((h: string) => h.toLowerCase().includes('status'));
      
      employeeSheet.rows.forEach((row: any[]) => {
        const empId = getCellValue(row[empIdIndex]);
        const status = getCellValue(row[statusIndex]);
        
        // EXCLUDE closed employees
        if (status && status.toLowerCase() === 'closed') return;
        
        const rate = Number(getCellValue(row[rateIndex])) || 150;
        if (empId) {
          employeeRates.set(empId, rate);
        }
      });
    }

    // Process projects
    if (projectSheet?.rows) {
      const headers = projectSheet.headers;
      const projectIndex = headers.findIndex((h: string) => h.toLowerCase().includes('project'));
      const budgetIndex = headers.findIndex((h: string) => h.toLowerCase().includes('budget'));
      const statusIndex = headers.findIndex((h: string) => h.toLowerCase().includes('status'));
      const customerIndex = headers.findIndex((h: string) => h.toLowerCase().includes('customer'));
      
      projectSheet.rows.forEach((row: any[]) => {
        const projectId = getCellValue(row[projectIndex]);
        const status = getCellValue(row[statusIndex]);
        
        // EXCLUDE closed projects
        if (status && status.toLowerCase() === 'closed') return;
        
        const projectName = getCellValue(row[projectIndex + 1]) || projectId;
        const budget = Number(getCellValue(row[budgetIndex])) || 0;
        const customer = getCellValue(row[customerIndex]) || 'Unknown';
        
        // Filter out unwanted projects
        const projectIdStr = String(projectId).toLowerCase();
        const projectNameStr = String(projectName).toLowerCase();
        
        // Skip if contains "service lines" or "service lines -"
        if (projectIdStr.includes('service') && projectIdStr.includes('line')) return;
        if (projectNameStr.includes('service') && projectNameStr.includes('line')) return;
        
        // Skip if contains any of these country/location codes
        const excludedCodes = ['680au', '480in', '622my', '115gb', '820tt', '211se', '550cn', '580kr', '621my', '110gb'];
        if (excludedCodes.some(code => projectIdStr.includes(code) || projectNameStr.includes(code))) return;
        
        // Skip if starts with a number
        if (/^\d/.test(projectIdStr)) return;

        if (projectId) {
          projects.set(projectId, {
            id: projectId,
            name: projectName,
            description: getCellValue(row[projectIndex + 2]) || '',
            budget: budget,
            actualSpent: 0,
            margin: budget,
            activities: [],
            employees: new Map(),
            notes: [],
            status: status || 'active',
            customer: customer,
            startDate: null,
            endDate: null
          });
        }
      });
    }

    // Process transactions and create activities
    if (transactionSheet?.rows) {
      const headers = transactionSheet.headers;
      
      // Find all relevant column indices
      const indices = {
        invoiced: headers.findIndex((h: string) => h === 'Invoiced'),
        employee: headers.findIndex((h: string) => h === 'Employee'),
        employeeDesc: headers.findIndex((h: string) => h === 'Employee Description'),
        date: headers.findIndex((h: string) => h === 'Account Date'),
        activitySeq: headers.findIndex((h: string) => h === 'Activity Seq'),
        activityShortName: headers.findIndex((h: string) => h === 'Activity Short Name'),
        project: headers.findIndex((h: string) => h === 'Project'),
        projectDesc: headers.findIndex((h: string) => h === 'Project Description'),
        subProject: headers.findIndex((h: string) => h === 'Sub Project'),
        subProjectDesc: headers.findIndex((h: string) => h === 'Sub Project Description'),
        activity: headers.findIndex((h: string) => h === 'Activity'),
        activityDesc: headers.findIndex((h: string) => h === 'Activity Description'),
        reportCode: headers.findIndex((h: string) => h === 'Report Code'),
        reportCodeDesc: headers.findIndex((h: string) => h === 'Report Code Description'),
        internalQuantity: headers.findIndex((h: string) => h === 'Internal Quantity'),
        internalPrice: headers.findIndex((h: string) => h === 'Internal Price'),
        totalInternalPrice: headers.findIndex((h: string) => h === 'Total Internal Price'),
        salesAmount: headers.findIndex((h: string) => h === 'Sales Amount'),
        invoiceStatus: headers.findIndex((h: string) => h === 'Invoice Status'),
        invoiceable: headers.findIndex((h: string) => h === 'Invoicability'),
        customer: headers.findIndex((h: string) => h === 'Customer Name')
      };

      console.log('Column indices found:', indices);
      console.log('Activity Description is in column:', String.fromCharCode(65 + indices.activityDesc), '(index', indices.activityDesc, ')');

      // Group transactions by project and activity
      const activityMap = new Map<string, Activity>();

      transactionSheet.rows.forEach((row: any[], rowIndex: number) => {
        // Skip header row
        if (rowIndex === 0 && getCellValue(row[0]) === 'Invoiced') return;
        
        const projectId = getCellValue(row[indices.project]);
        const activitySeq = getCellValue(row[indices.activitySeq]);
        const activityDesc = getCellValue(row[indices.activityDesc]) || '';
        const subProject = getCellValue(row[indices.subProject]) || '';
        const subProjectDesc = getCellValue(row[indices.subProjectDesc]) || '';
        
        if (!projectId || !projects.has(projectId)) return;
        
        const project = projects.get(projectId)!;
        
        // Create unique activity key
        const activityKey = `${projectId}:${activitySeq || 'main'}:${subProject || 'main'}`;
        
        if (!activityMap.has(activityKey)) {
          const newActivity: Activity = {
            id: activityKey,
            projectId: projectId,
            activitySeq: String(activitySeq || ''),
            activityShortName: getCellValue(row[indices.activityShortName]) || '',
            activityDescription: activityDesc,
            subProject: subProject,
            subProjectDescription: subProjectDesc,
            reportCode: getCellValue(row[indices.reportCode]) || '',
            reportCodeDescription: getCellValue(row[indices.reportCodeDesc]) || '',
            budget: 0, // Will calculate based on project budget allocation
            spent: 0,
            hours: 0,
            transactions: [],
            employees: new Map()
          };
          activityMap.set(activityKey, newActivity);
          project.activities.push(newActivity);
        }
        
        const activity = activityMap.get(activityKey)!;
        
        // Create transaction record
        const transaction: Transaction = {
          date: getCellValue(row[indices.date]) ? new Date(getCellValue(row[indices.date])) : new Date(),
          employee: getCellValue(row[indices.employee]) || '',
          employeeName: getCellValue(row[indices.employeeDesc]) || '',
          hours: Number(getCellValue(row[indices.internalQuantity])) || 0,
          internalPrice: Number(getCellValue(row[indices.totalInternalPrice])) || 0,
          salesAmount: Number(getCellValue(row[indices.salesAmount])) || 0,
          invoiceStatus: getCellValue(row[indices.invoiceStatus]) || '',
          invoiceable: getCellValue(row[indices.invoiceable]) || ''
        };
        
        // Add transaction to activity
        activity.transactions.push(transaction);
        activity.spent += transaction.internalPrice;
        activity.hours += transaction.hours;
        
        // Track employee work on activity
        const empId = transaction.employee;
        if (empId) {
          if (!activity.employees.has(empId)) {
            activity.employees.set(empId, {
              id: empId,
              name: transaction.employeeName,
              hours: 0,
              cost: 0,
              transactions: []
            });
          }
          
          const empActivity = activity.employees.get(empId)!;
          empActivity.hours += transaction.hours;
          empActivity.cost += transaction.internalPrice;
          empActivity.transactions.push(transaction);
          
          // Update project-level employee tracking
          if (!project.employees.has(empId)) {
            project.employees.set(empId, {
              id: empId,
              name: transaction.employeeName,
              totalHours: 0,
              totalCost: 0,
              hourlyRate: employeeRates.get(empId) || 150,
              activities: []
            });
          }
          
          const projectEmployee = project.employees.get(empId)!;
          projectEmployee.totalHours += transaction.hours;
          projectEmployee.totalCost += transaction.internalPrice;
          if (!projectEmployee.activities.includes(activity.activityDescription)) {
            projectEmployee.activities.push(activity.activityDescription);
          }
        }
        
        // Update project totals
        project.actualSpent += transaction.internalPrice;
        
        // Update project dates
        if (transaction.date) {
          if (!project.startDate || transaction.date < project.startDate) {
            project.startDate = transaction.date;
          }
          if (!project.endDate || transaction.date > project.endDate) {
            project.endDate = transaction.date;
          }
        }
      });
      
      // Calculate activity budgets and project margins
      projects.forEach(project => {
        // Allocate budget to activities proportionally
        const totalActivities = project.activities.length || 1;
        project.activities.forEach(activity => {
          activity.budget = project.budget / totalActivities; // Simple equal allocation
          // Could be enhanced with weighted allocation based on planned hours or complexity
        });
        
        // Calculate project margin
        project.margin = project.budget - project.actualSpent;
      });
    }

    return projects;
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    
    const note: Note = {
      id: `note_${Date.now()}`,
      projectId: selectedProject,
      activityId: selectedActivity,
      text: newNote,
      author: currentUser,
      timestamp: new Date(),
      category: noteCategory
    };
    
    // Add note to project
    const project = projects.get(selectedProject);
    if (project) {
      project.notes.push(note);
      setProjects(new Map(projects));
      
      // Prepare data for writing back to AE.xlsx
      const noteData = {
        projectId: selectedProject,
        activityId: selectedActivity,
        note: newNote,
        author: currentUser,
        timestamp: new Date().toISOString(),
        category: noteCategory
      };
      
      try {
        // This would write to a new column in AE.xlsx
        await invoke('add_note_to_excel', {
          filePath: '/Users/chris/Downloads/AE.xlsx',
          noteData: noteData
        });
        
        setStatus('Note added and saved to AE.xlsx');
      } catch (error) {
        console.error('Error saving note:', error);
        setStatus('Note added locally but failed to save to Excel');
      }
    }
    
    setNewNote('');
    setShowNoteDialog(false);
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

  const getHealthColor = (margin: number, budget: number) => {
    const percentage = (margin / budget) * 100;
    if (margin < 0) return '#ef4444'; // Over budget
    if (percentage < 10) return '#f59e0b'; // Low margin
    if (percentage < 30) return '#3b82f6'; // OK margin
    return '#10b981'; // Good margin
  };

  const toggleActivity = (activityId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedActivities(newExpanded);
  };

  const loadProjectNotes = async (projectId: string) => {
    try {
      const notes = await invoke<string>('load_project_notes', { projectId });
      setProjectNotes(prev => ({ ...prev, [projectId]: notes }));
    } catch (error) {
      console.log('No existing notes for project:', projectId);
      setProjectNotes(prev => ({ ...prev, [projectId]: '' }));
    }
  };

  const saveProjectNotes = async (projectId: string, notes: string) => {
    try {
      await invoke('save_project_notes', { projectId, notes });
      console.log('Notes saved for project:', projectId);
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  };

  const handleNotesChange = (projectId: string, notes: string) => {
    setProjectNotes(prev => ({ ...prev, [projectId]: notes }));
    
    // Clear existing timeout
    if (notesSaveTimeout) {
      clearTimeout(notesSaveTimeout);
    }
    
    // Set new timeout for auto-save (save after 1 second of no typing)
    const timeout = setTimeout(() => {
      saveProjectNotes(projectId, notes);
    }, 1000);
    
    setNotesSaveTimeout(timeout);
  };

  // Handle mapping changes for different views
  const handleMappingChange = (key: string, newMapping: ColumnMapping) => {
    if (showMappingEditor === 'project-list') {
      setProjectListMappings(prev => ({
        ...prev,
        [key]: newMapping
      }));
    } else if (showMappingEditor === 'project-detail') {
      setProjectDetailMappings(prev => ({
        ...prev,
        [key]: newMapping
      }));
    } else if (showMappingEditor === 'activity-table') {
      setActivityMappings(prev => ({
        ...prev,
        [key]: newMapping
      }));
    }
    // In a real app, you'd trigger data reprocessing here
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
            📊 Enhanced Project Dashboard with Activity Details & Mappings
          </h1>
          <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>{status}</p>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>

        {false && (
          <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'white', borderRadius: '12px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <h3>Loading and Processing Data...</h3>
            <p style={{ color: '#64748b' }}>Excluding closed tasks and projects</p>
          </div>
        )}

        {projects.size > 0 && (
          <>
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
                    showMappingEditor === 'project-list' ? projectListMappings :
                    showMappingEditor === 'project-detail' ? projectDetailMappings :
                    activityMappings
                  }
                  onMappingChange={handleMappingChange}
                  onClose={() => setShowMappingEditor(null)}
                />
              </>
            )}

            {/* Projects List - Alphabetical Table */}
            {!selectedProject && (
              <div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  marginBottom: '10px'
                }}>
                  <button
                    onClick={() => setShowMappingEditor('project-list')}
                    style={{
                      padding: '8px 16px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                    title="Edit data source mappings"
                  >
                    📊 Edit Mappings
                  </button>
                </div>
                <div style={{ 
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                        <ColumnHeader 
                          label="Project Name" 
                          mapping={projectListMappings.projectName}
                          onEditClick={() => setShowMappingEditor('project-list')}
                        />
                        <ColumnHeader 
                          label="Client" 
                          mapping={projectListMappings.client}
                          onEditClick={() => setShowMappingEditor('project-list')}
                        />
                        <ColumnHeader 
                          label="Budget" 
                          mapping={projectListMappings.budget}
                          onEditClick={() => setShowMappingEditor('project-list')}
                          textAlign="right"
                        />
                        <ColumnHeader 
                          label="Spent" 
                          mapping={projectListMappings.spent}
                          onEditClick={() => setShowMappingEditor('project-list')}
                          textAlign="right"
                        />
                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600' }}>Remaining</th>
                        <ColumnHeader 
                          label="Status" 
                          mapping={projectListMappings.status}
                          onEditClick={() => setShowMappingEditor('project-list')}
                          textAlign="center"
                        />
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>Activities</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>Team</th>
                      </tr>
                    </thead>
                  <tbody>
                    {Array.from(projects.entries())
                      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                      .map(([id, project]) => {
                        const utilization = (project.actualSpent / project.budget) * 100;
                        const statusColor = utilization > 100 ? '#ef4444' : 
                                          utilization > 90 ? '#f59e0b' : 
                                          utilization > 70 ? '#3b82f6' : '#10b981';
                        
                        return (
                          <tr 
                            key={id}
                            onClick={() => setSelectedProject(id)}
                            style={{ 
                              cursor: 'pointer',
                              borderBottom: '1px solid #e5e7eb',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8fafc';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                            }}
                          >
                            <td style={{ padding: '16px 12px', fontWeight: '500' }}>{project.name}</td>
                            <td style={{ padding: '16px 12px', color: '#6b7280' }}>{project.customer}</td>
                            <td style={{ padding: '16px 12px', textAlign: 'right' }}>{formatCurrency(project.budget)}</td>
                            <td style={{ padding: '16px 12px', textAlign: 'right', color: '#ef4444' }}>
                              {formatCurrency(project.actualSpent)}
                            </td>
                            <td style={{ 
                              padding: '16px 12px', 
                              textAlign: 'right',
                              color: project.margin >= 0 ? '#10b981' : '#ef4444',
                              fontWeight: '500'
                            }}>
                              {formatCurrency(project.margin)}
                            </td>
                            <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: 'white',
                                backgroundColor: statusColor
                              }}>
                                {utilization.toFixed(0)}%
                              </span>
                            </td>
                            <td style={{ padding: '16px 12px', textAlign: 'center' }}>{project.activities.length}</td>
                            <td style={{ padding: '16px 12px', textAlign: 'center' }}>{project.employees.size}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Project Detail View */}
            {selectedProject && projects.get(selectedProject) && (
              <div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '20px'
                }}>
                  <button
                    onClick={() => setSelectedProject('')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back to Projects
                  </button>
                  <button
                    onClick={() => setShowMappingEditor('project-detail')}
                    style={{
                      padding: '8px 16px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                    title="Edit data source mappings"
                  >
                    📊 Edit Mappings
                  </button>
                </div>

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
                      <h2 style={{ margin: '0 0 10px 0', fontSize: '28px' }}>
                        {projects.get(selectedProject)!.name}
                      </h2>
                      <p style={{ color: '#6b7280' }}>{projects.get(selectedProject)!.description}</p>
                    </div>
                  </div>

                  {/* Budget Summary */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(5, 1fr)', 
                    gap: '20px',
                    marginTop: '30px'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Budget</div>
                      <div style={{ fontSize: '24px', fontWeight: '700' }}>
                        {formatCurrency(projects.get(selectedProject)!.budget)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Actual Spent</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
                        {formatCurrency(projects.get(selectedProject)!.actualSpent)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Margin</div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: '700',
                        color: getHealthColor(
                          projects.get(selectedProject)!.margin,
                          projects.get(selectedProject)!.budget
                        )
                      }}>
                        {formatCurrency(projects.get(selectedProject)!.margin)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Utilization</div>
                      <div style={{ fontSize: '24px', fontWeight: '700' }}>
                        {((projects.get(selectedProject)!.actualSpent / projects.get(selectedProject)!.budget) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Date Range</div>
                      <div style={{ fontSize: '14px', fontWeight: '600' }}>
                        {formatDate(projects.get(selectedProject)!.startDate)} - {formatDate(projects.get(selectedProject)!.endDate)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes Section - Always Visible */}
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '20px', 
                  borderRadius: '12px',
                  marginBottom: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: '600' }}>Project Notes</h3>
                  <textarea
                    value={projectNotes[selectedProject] || ''}
                    onChange={(e) => handleNotesChange(selectedProject, e.target.value)}
                    placeholder="Add project notes here... These notes will be saved automatically."
                    style={{
                      width: '100%',
                      minHeight: '200px',
                      padding: '12px',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ 
                    marginTop: '10px', 
                    fontSize: '12px', 
                    color: '#6b7280',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Notes are saved automatically</span>
                    {projectNotes[selectedProject] && (
                      <span>{projectNotes[selectedProject].length} characters</span>
                    )}
                  </div>
                </div>

                {/* Activities Section */}
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px',
                  marginBottom: '20px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    padding: '20px',
                    borderBottom: '2px solid #e5e7eb',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>
                      Sub-Activities ({projects.get(selectedProject)!.activities.length})
                    </h3>
                    <button
                      onClick={() => setShowMappingEditor('activity-table')}
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
                      title="Edit mappings for activity table"
                    >
                      📊 Edit Mappings
                    </button>
                  </div>
                  
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                        <ColumnHeader 
                          label="Activity" 
                          mapping={activityMappings.activity}
                          onEditClick={() => setShowMappingEditor('activity-table')}
                        />
                        <ColumnHeader 
                          label="Sub-Project" 
                          mapping={activityMappings.subProject}
                          onEditClick={() => setShowMappingEditor('activity-table')}
                        />
                        <ColumnHeader 
                          label="Budget" 
                          mapping={activityMappings.activityBudget}
                          onEditClick={() => setShowMappingEditor('activity-table')}
                          textAlign="right"
                        />
                        <ColumnHeader 
                          label="Spent" 
                          mapping={activityMappings.activitySpent}
                          onEditClick={() => setShowMappingEditor('activity-table')}
                          textAlign="right"
                        />
                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600' }}>Remaining</th>
                        <ColumnHeader 
                          label="Hours" 
                          mapping={activityMappings.hours}
                          onEditClick={() => setShowMappingEditor('activity-table')}
                          textAlign="center"
                        />
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Team</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.get(selectedProject)!.activities.map(activity => {
                        const remaining = activity.budget - activity.spent;
                        const utilization = activity.budget > 0 ? (activity.spent / activity.budget) * 100 : 0;
                        
                        return (
                          <tr 
                            key={activity.id}
                            style={{ 
                              borderBottom: '1px solid #e5e7eb',
                              cursor: 'pointer'
                            }}
                            onClick={() => toggleActivity(activity.id)}
                          >
                            <td style={{ padding: '12px', fontWeight: '500' }}>
                              {activity.activityDescription || 'Unnamed Activity'}
                            </td>
                            <td style={{ padding: '12px', color: '#6b7280', fontSize: '13px' }}>
                              {activity.subProjectDescription || '-'}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              {formatCurrency(activity.budget)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>
                              {formatCurrency(activity.spent)}
                            </td>
                            <td style={{ 
                              padding: '12px', 
                              textAlign: 'right',
                              color: remaining >= 0 ? '#10b981' : '#ef4444',
                              fontWeight: '500'
                            }}>
                              {formatCurrency(remaining)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {activity.hours.toFixed(1)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {activity.employees.size}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleActivity(activity.id);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  backgroundColor: expandedActivities.has(activity.id) ? '#3b82f6' : '#e5e7eb',
                                  color: expandedActivities.has(activity.id) ? 'white' : '#6b7280',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                {expandedActivities.has(activity.id) ? 'Hide' : 'Details'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Expanded Activity Details */}
                {Array.from(expandedActivities).map(activityId => {
                  const activity = projects.get(selectedProject)!.activities.find(a => a.id === activityId);
                  if (!activity) return null;
                  
                  return (
                    <div key={activityId} style={{ 
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr 1fr 1fr',
                            gap: '15px',
                            marginBottom: '15px'
                          }}>
                            <div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>Activity Code</div>
                              <div style={{ fontWeight: '500' }}>{activity.activityShortName || 'N/A'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>Report Code</div>
                              <div style={{ fontWeight: '500' }}>{activity.reportCode || 'N/A'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>Transactions</div>
                              <div style={{ fontWeight: '500' }}>{activity.transactions.length}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>Team Members</div>
                              <div style={{ fontWeight: '500' }}>{activity.employees.size}</div>
                            </div>
                          </div>

                          {/* Employee breakdown */}
                          {activity.employees.size > 0 && (
                            <div>
                              <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Team Members on this Activity:</h4>
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                gap: '10px'
                              }}>
                                {Array.from(activity.employees.values()).map(emp => (
                                  <div key={emp.id} style={{ 
                                    padding: '10px',
                                    backgroundColor: '#f1f5f9',
                                    borderRadius: '6px',
                                    fontSize: '13px'
                                  }}>
                                    <div style={{ fontWeight: '600' }}>{emp.name}</div>
                                    <div style={{ color: '#6b7280' }}>
                                      {emp.hours.toFixed(1)} hours • {formatCurrency(emp.cost)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => {
                              setSelectedActivity(activity.id);
                              setShowNoteDialog(true);
                            }}
                            style={{
                              marginTop: '15px',
                              padding: '6px 12px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '13px'
                            }}
                          >
                            Add Note to Activity
                          </button>
                        </div>
                  );
                })}

              {/* Notes Section */}
              {projects.get(selectedProject)!.notes.length > 0 && (
                  <div style={{ 
                    backgroundColor: 'white', 
                    padding: '30px', 
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>📝 Notes</h3>
                    {projects.get(selectedProject)!.notes.map(note => (
                      <div key={note.id} style={{ 
                        padding: '15px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        marginBottom: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ fontWeight: '600' }}>{note.author}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {note.timestamp.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ marginBottom: '5px' }}>{note.text}</div>
                        <div style={{ 
                          display: 'inline-block',
                          padding: '2px 8px',
                          backgroundColor: note.category === 'risk' ? '#fee2e2' :
                                         note.category === 'budget' ? '#fef3c7' :
                                         note.category === 'progress' ? '#dcfce7' : '#e0e7ff',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          {note.category}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

            {/* Note Dialog */}
            {showNoteDialog && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '12px',
                  width: '500px',
                  maxWidth: '90%'
                }}>
                  <h3 style={{ margin: '0 0 20px 0' }}>Add Note</h3>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Category</label>
                    <select
                      value={noteCategory}
                      onChange={(e) => setNoteCategory(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    >
                      <option value="general">General</option>
                      <option value="budget">Budget</option>
                      <option value="risk">Risk</option>
                      <option value="progress">Progress</option>
                    </select>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Note</label>
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Enter your note..."
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        minHeight: '100px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setShowNoteDialog(false);
                        setNewNote('');
                        setSelectedActivity('');
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addNote}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Add Note
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default EnhancedProjectDashboard;