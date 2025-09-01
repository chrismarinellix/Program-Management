# Component Structure - Grid Connection Dashboard

## Component Hierarchy

```
App
└── GridConnectionDashboard (Main Container)
    ├── Header
    │   ├── Title: "Grid Connection Program"
    │   ├── DataStatusIndicator (shows loading state)
    │   └── SettingsButton → Settings
    │
    ├── Navigation Bar
    │   ├── Projects Button → ProjectsDashboard
    │   ├── Budget Button → BudgetTracker
    │   ├── Alerts Button → BudgetAlerts
    │   ├── Hours Button → HoursTracking
    │   ├── Revenue Button → RevenueAnalysis
    │   ├── Pipeline Button → PipelineManager
    │   ├── Program Button → ExcelEditor
    │   ├── Map Button → ProjectMap
    │   └── Vacation Button → VacationPlanner
    │
    └── Content Area (View Router)
        ├── ProjectsDashboard
        │   ├── ProjectsTable
        │   ├── ProjectFilters
        │   └── ProjectNotes (modal)
        │
        ├── BudgetTracker
        │   ├── BudgetSummaryCards
        │   ├── BudgetChart
        │   ├── ActivityTable
        │   └── BudgetAlerts (inline)
        │
        ├── BudgetAlerts
        │   ├── AlertFilters
        │   └── AlertsTable
        │
        ├── HoursTracking
        │   ├── HoursSummary
        │   ├── EmployeeHoursChart
        │   └── HoursDetailTable
        │
        ├── RevenueAnalysis
        │   ├── RevenueSummaryCards
        │   ├── TEvsFixedChart
        │   └── RevenueTable
        │
        ├── PipelineManager
        │   ├── PipelineFilters
        │   ├── PipelineTable (editable)
        │   └── SaveButton
        │
        ├── ExcelEditor (Program View)
        │   ├── ActionsBar
        │   ├── DataGrid
        │   │   ├── HeaderRow (with filters)
        │   │   └── DataRows (editable cells)
        │   └── SaveButton
        │
        ├── ProjectMap
        │   ├── MapHeader
        │   ├── AddLocationForm
        │   └── LeafletMap
        │       └── Markers → Popups
        │
        ├── VacationPlanner
        │   ├── CalendarView
        │   ├── EmployeeList
        │   └── DateRangePicker
        │
        └── Settings (Modal)
            ├── TabNavigation
            │   ├── General Tab
            │   ├── File Paths Tab
            │   ├── Users Tab
            │   ├── Inspector Tab
            │   ├── Pivot Tab
            │   └── Diagnostics Tab
            │
            ├── GeneralSettings
            │   ├── TooltipToggle
            │   └── TabVisibility
            │
            ├── FilePathsSettings
            │   ├── FilePathInput (P.xlsx)
            │   ├── FilePathInput (PT.xlsx)
            │   ├── FilePathInput (AE.xlsx)
            │   ├── FilePathInput (Program_Management.xlsm)
            │   └── LoadDataButton
            │
            ├── UsersManagement
            │   ├── UsersList
            │   ├── AddUserForm
            │   └── PermissionsEditor
            │
            ├── DataInspector
            │   ├── DataSourceTable
            │   └── ColumnMappings
            │
            ├── PivotTables
            │   ├── RefreshButton
            │   ├── PTTransactionsTable (5 rows)
            │   └── BudgetComparisonTable (5 rows)
            │
            └── SystemDiagnostics
                ├── DiagnosticSummary
                ├── DiagnosticChecks (10 items)
                └── RunDiagnosticsButton
```

## Component Dependencies

### Data Flow
```
GridConnectionDashboard
    ↓ (loads all data)
    ├── globalDataCache (in-memory)
    ├── SQLite Database (persistent)
    └── Excel Files (source)
        ↓ (passes data props)
    All Child Components
```

### Shared Services
```
/services/
├── database.ts (used by: Settings, PivotTables, ProjectNotes)
├── excelProcessor.ts (used by: GridConnectionDashboard)
└── calculations.ts (used by: BudgetTracker, RevenueAnalysis)
```

### Configuration Files
```
/config/
├── dataSourceMapping.ts (used by: DataInspector, all views)
└── constants.ts (used by: all components)
```

## Component Responsibilities

### Container Components (Smart)
- **GridConnectionDashboard**: Main data loading, routing, state management
- **Settings**: User preferences, file paths, system config
- **PipelineManager**: Excel editing, data persistence
- **ProjectMap**: Location management, geocoding

### Presentation Components (Dumb)
- **DataInspector**: Display only, no state
- **SystemDiagnostics**: Runs checks, displays results
- **ProjectsTable**: Display with sorting/filtering
- **Charts**: Visualization only

### Hybrid Components
- **BudgetTracker**: Calculations + display
- **PivotTables**: Caching + calculations + display
- **ExcelEditor**: Display + inline editing

## State Management

### Global State
- `globalDataCache` - All Excel data (window.getGlobalDataCache)
- `localStorage` - Settings, preferences
- `SQLite` - Cached data, notes, kanban

### Component State
- Form inputs (local useState)
- UI toggles (local useState)
- Filtered/sorted data (local useState)

### Event-Based Updates
- `forceReloadData` - Triggers data refresh
- `settingsUpdated` - Settings changed
- `dataLoadingProgress` - Loading status

## Routing Logic

### View Selection
```javascript
activeView === 'projects' → <ProjectsDashboard />
activeView === 'budget' → <BudgetTracker />
activeView === 'settings' → <Settings />
// etc...
```

### Tab Visibility
- Controlled by `hiddenTabs` array in localStorage
- Navigation buttons conditionally rendered

## Data Props Pattern

### Standard Props
```typescript
interface ComponentProps {
  data?: GlobalDataCache;
  onRefresh?: () => void;
  isLoading?: boolean;
}
```

### Excel-Specific Props
```typescript
// BudgetTracker
{
  pData: cache.p,    // Projects
  ptData: cache.pt,  // Transactions
  aeData: cache.ae   // Estimates
}

// ExcelEditor
{
  data: cache,       // Full cache
  sheetName: 'program'
}
```

## Loading States

### Initial Load
1. GridConnectionDashboard checks cache
2. Shows loading animation
3. Loads from SQL or Excel
4. Updates all components

### Force Reload
1. User clicks Force Reload
2. Clear cache (memory + SQL)
3. Load fresh from Excel
4. Update all components

## Error Boundaries

*Currently not implemented - recommended addition*

```typescript
<ErrorBoundary>
  <GridConnectionDashboard />
</ErrorBoundary>
```

## Performance Optimizations

### Implemented
- SQL caching (7-day expiry)
- In-memory cache (immediate access)
- Lazy loading (components load on demand)

### Recommended
- React.memo for pure components
- useMemo for expensive calculations
- Virtual scrolling for large tables

---
*Last Updated: January 2025*
*Version: 2.0*