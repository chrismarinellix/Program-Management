/**
 * Centralized Type Definitions for Grid Connection Dashboard
 * This file contains all shared TypeScript interfaces and types
 */

// ============= Excel Data Types =============

export interface DataValue {
  Text?: string;
  Number?: number;
  DateTime?: string;
  Bool?: boolean;
}

export interface ExcelData {
  sheet_name: string;
  headers: string[];
  rows: any[][];
}

export interface CellUpdate {
  row: number;
  column: number;
  value: DataValue | string;
}

// ============= Global Data Cache =============

export interface GlobalDataCache {
  // Direct sheet access
  p: ExcelData | null;      // P.xlsx - Projects
  pt: ExcelData | null;     // PT.xlsx - Transactions
  ae: ExcelData | null;     // AE.xlsx - Estimates
  program: ExcelData | null; // Program Quick View sheet
  pipeline: ExcelData | null; // Pipeline sheet
  vacation: ExcelData | null; // Vacation sheet
  
  // Legacy array format (backward compatibility)
  pData?: ExcelData[];
  ptData?: ExcelData[];
  aeData?: ExcelData[];
  pmData?: ExcelData[];
}

// ============= Project Types =============

export interface Project {
  id: string;
  name: string;
  status: 'Active' | 'In Progress' | 'On Hold' | 'Pending' | 'Closed' | 'Cancelled';
  budget: number;
  actualSpent: number;
  startDate: Date;
  endDate: Date;
  client?: string;
  location?: string;
  description?: string;
}

export interface Activity {
  activitySeq: string;
  projectId: string;
  description: string;
  budgetHours: number;
  actualHours: number;
  budgetCost: number;
  actualCost: number;
  status: string;
}

export interface Transaction {
  projectId: string;
  activitySeq: string;
  date: Date;
  employee: string;
  hours: number;
  internalCost: number;
  salesAmount: number;
  revenueType: 'T&E' | 'Fixed' | string;
}

// ============= Budget & Financial Types =============

export interface BudgetSummary {
  projectId: string;
  projectName: string;
  budget: number;
  actualSpent: number;
  remaining: number;
  utilization: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface PivotRow {
  activitySeq: string;
  project: string;
  activity: string;
  hours: number;
  cost: number;
  revenue: number;
  count: number;
}

export interface BudgetPivotRow {
  projectId: string;
  projectName: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
  teRevenue: number;
  fixedRevenue: number;
}

// ============= Pipeline & Program Types =============

export interface PipelineStage {
  id: string;
  projectId: string;
  stage: 'Opportunity' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';
  value: number;
  probability: number;
  expectedDate: Date;
}

export interface ProgramStatus {
  programName: string;
  ragStatus: 'Red' | 'Amber' | 'Green';
  owner: string;
  nextMilestone: string;
  commentary?: string;
  issues?: string;
  actions?: string;
}

// ============= Settings & Configuration =============

export interface DataFilePaths {
  pFile: string;
  ptFile: string;
  aeFile: string;
  programFile: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  permissions: {
    projects: boolean;
    budget: boolean;
    settings: boolean;
  };
}

export interface AppSettings {
  showTooltips: boolean;
  hiddenTabs: string[];
  dataFilePaths: DataFilePaths;
  pivotRowLimit: number;
}

// ============= Database Types =============

export interface DataCache {
  id: number;
  cache_type: string;
  data: string; // JSON stringified
  source_files: string;
  created_at: string;
  expires_at: string;
}

export interface ProjectNote {
  id: number;
  project_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  project_id: string;
  created_at: string;
  updated_at: string;
}

// ============= Component Props =============

export interface DashboardProps {
  data: GlobalDataCache | null;
}

export interface ChartProps {
  data: any[];
  title?: string;
  height?: number;
  showLegend?: boolean;
}

export interface TableProps {
  headers: string[];
  rows: any[][];
  onCellEdit?: (row: number, col: number, value: string) => void;
  editable?: boolean;
}

// ============= Data Source Mapping =============

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

export interface ColumnMapping {
  [fileName: string]: {
    [column: string]: string;
  };
}

// ============= Diagnostic Types =============

export interface DiagnosticCheck {
  name: string;
  description: string;
  status: 'pending' | 'checking' | 'success' | 'error' | 'warning';
  message?: string;
  details?: any;
}

// ============= Event Types =============

export interface DataLoadingProgress {
  pFile: number;
  ptFile: number;
  aeFile: number;
  programFile: number;
}

export interface CustomEventMap {
  'forceReloadData': CustomEvent;
  'settingsUpdated': CustomEvent<{ hiddenTabs?: string[] }>;
  'dataLoadingProgress': CustomEvent<{
    progress: DataLoadingProgress;
    isLoading: boolean;
  }>;
}

// ============= Utility Types =============

export type ViewType = 
  | 'projects' 
  | 'budget' 
  | 'pipeline' 
  | 'program' 
  | 'vacation' 
  | 'map' 
  | 'alerts' 
  | 'hours' 
  | 'revenue' 
  | 'settings';

export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

export type DateRange = {
  start: Date;
  end: Date;
};

// ============= Type Guards =============

export function isExcelData(data: any): data is ExcelData {
  return data && 
    typeof data.sheet_name === 'string' &&
    Array.isArray(data.headers) &&
    Array.isArray(data.rows);
}

export function isProject(obj: any): obj is Project {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.budget === 'number';
}

// ============= Constants =============

export const VALID_PROJECT_STATUSES = ['Active', 'In Progress', 'On Hold', 'Pending'] as const;
export const EXCLUDED_PROJECT_STATUSES = ['Closed', 'Cancelled', 'Completed'] as const;

export const EXCEL_DATE_OFFSET = 25569; // Days between 1900-01-01 and 1970-01-01
export const CACHE_EXPIRY_DAYS = 7;

export const BUDGET_THRESHOLDS = {
  CRITICAL: 100, // > 100% utilized
  WARNING: 90,   // > 90% utilized
  CAUTION: 75    // > 75% utilized
} as const;