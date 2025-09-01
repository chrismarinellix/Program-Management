// Data Source Mapping Configuration
// This file maps which Excel sheets/columns feed into which dashboard views

export interface DataSourceMap {
  view: string;
  displayName: string;
  description: string;
  sourceFiles: string[];
  sourceSheets: string[];
  keyColumns: string[];
  headerRow: number;
  notes: string;
}

export const dataSourceMappings: DataSourceMap[] = [
  {
    view: 'projects',
    displayName: 'Projects Dashboard',
    description: 'Main project overview and status',
    sourceFiles: ['P.xlsx', 'PT.xlsx'],
    sourceSheets: ['Projects', 'Transactions'],
    keyColumns: ['Project ID', 'Project Name', 'Status', 'Budget'],
    headerRow: 1,
    notes: 'Combines project master data with transaction summaries'
  },
  {
    view: 'budget',
    displayName: 'Budget Tracker',
    description: 'Budget vs actual spending analysis',
    sourceFiles: ['P.xlsx', 'PT.xlsx', 'AE.xlsx'],
    sourceSheets: ['Projects', 'Transactions', 'Estimates'],
    keyColumns: ['Activity Seq', 'Budget Amount', 'Actual Amount'],
    headerRow: 1,
    notes: 'Calculates T&E vs Fixed revenue, budget utilization'
  },
  {
    view: 'pipeline',
    displayName: 'Pipeline Manager',
    description: 'Project pipeline and lifecycle stages',
    sourceFiles: ['Program_Management.xlsm'],
    sourceSheets: ['Pipeline'],
    keyColumns: ['Project ID', 'Stage', 'Status', 'Expected Date'],
    headerRow: 11,
    notes: 'IMPORTANT: Pipeline sheet headers are in row 11, not row 1'
  },
  {
    view: 'vacation',
    displayName: 'Vacation Planner',
    description: 'Team availability and resource planning',
    sourceFiles: ['Program_Management.xlsm'],
    sourceSheets: ['Vacation'],
    keyColumns: ['Employee', 'Start Date', 'End Date', 'Type'],
    headerRow: 1,
    notes: 'Tracks team member availability for resource planning'
  },
  {
    view: 'program',
    displayName: 'Program Management',
    description: 'Executive program oversight with RAG ratings',
    sourceFiles: ['Program_Management.xlsm'],
    sourceSheets: ['Program Quick View'],
    keyColumns: ['Program Name', 'RAG Status', 'Owner', 'Next Milestone'],
    headerRow: 3,
    notes: 'Uses "Program Quick View" sheet. Headers are in row 3. RAG (Red/Amber/Green) status'
  },
  {
    view: 'alerts',
    displayName: 'Budget Alerts',
    description: 'Activities exceeding budget thresholds',
    sourceFiles: ['PT.xlsx', 'AE.xlsx'],
    sourceSheets: ['Transactions', 'Estimates'],
    keyColumns: ['Activity Seq', 'Budget', 'Actual', 'Variance %'],
    headerRow: 1,
    notes: 'Alerts when activities exceed 90% of budget'
  },
  {
    view: 'hours',
    displayName: 'Hours Tracking',
    description: 'Time tracking by project and activity',
    sourceFiles: ['PT.xlsx'],
    sourceSheets: ['Transactions'],
    keyColumns: ['Internal Quantity (Hours)', 'Employee', 'Activity'],
    headerRow: 1,
    notes: 'Column S contains hours worked'
  },
  {
    view: 'revenue',
    displayName: 'Revenue Analysis',
    description: 'T&E vs Fixed revenue comparison',
    sourceFiles: ['PT.xlsx'],
    sourceSheets: ['Transactions'],
    keyColumns: ['Sales Amount', 'Revenue Type', 'Project'],
    headerRow: 1,
    notes: 'Column AH contains sales/revenue amount'
  },
  {
    view: 'map',
    displayName: 'Project Map',
    description: 'Geographic project locations',
    sourceFiles: ['P.xlsx'],
    sourceSheets: ['Projects'],
    keyColumns: ['Project Location', 'Latitude', 'Longitude'],
    headerRow: 1,
    notes: 'Requires location data in project records'
  }
];

// Column mappings for key data fields
export const columnMappings = {
  'PT.xlsx': {
    'A': 'Project ID',
    'E': 'Activity Seq',
    'H': 'Project Description',
    'L': 'Activity Description',
    'S': 'Internal Quantity (Hours)',
    'Y': 'Internal Amount (Cost)',
    'AH': 'Sales Amount (Revenue)'
  },
  'AE.xlsx': {
    'B': 'Project ID',
    'C': 'Project Name',
    'G': 'Activity Description',
    'K': 'Estimated Cost',
    'L': 'Estimated Revenue',
    'M': 'Estimated Hours',
    'S': 'Activity Seq'
  },
  'P.xlsx': {
    'A': 'Project ID',
    'B': 'Project Name',
    'C': 'Status',
    'D': 'Budget',
    'E': 'Start Date',
    'F': 'End Date'
  }
};

// Get source info for a specific view
export function getDataSourceInfo(viewName: string): DataSourceMap | undefined {
  return dataSourceMappings.find(m => m.view === viewName);
}

// Get all views that use a specific file
export function getViewsUsingFile(fileName: string): DataSourceMap[] {
  return dataSourceMappings.filter(m => 
    m.sourceFiles.some(f => f.toLowerCase() === fileName.toLowerCase())
  );
}

// Format source info for tooltip
export function formatSourceTooltip(viewName: string): string {
  const source = getDataSourceInfo(viewName);
  if (!source) return 'Source information not available';
  
  return `Data Source: ${source.sourceFiles.join(', ')}
Sheet: ${source.sourceSheets.join(', ')}
Header Row: ${source.headerRow}
${source.notes ? `Note: ${source.notes}` : ''}`;
}