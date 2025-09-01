# API Reference - Grid Connection Dashboard

## Tauri Backend Commands

### System Commands

#### `ping()`
Health check for Tauri backend
- **Returns**: `string` - "pong"
- **Usage**: Testing backend connectivity

#### `file_exists(path: string)`
Check if a file exists at the given path
- **Parameters**: 
  - `path`: Absolute file path
- **Returns**: `boolean`

### Excel Operations

#### `read_excel(filePath: string)`
Load Excel file and parse all sheets
- **Parameters**: 
  - `filePath`: Absolute path to Excel file
- **Returns**: `ExcelData[]` - Array of sheets
- **Note**: Headers extracted based on sheet type (row 1, 3, or 11)

#### `write_excel(filePath: string, data: ExcelData[])`
Write data back to Excel file
- **Parameters**:
  - `filePath`: Target file path
  - `data`: Array of sheet data
- **Returns**: `void`

#### `update_excel_cells(filePath: string, sheetName: string, updates: CellUpdate[])`
Update specific cells in Excel
- **Parameters**:
  - `filePath`: Excel file path
  - `sheetName`: Target sheet name
  - `updates`: Array of cell updates
- **Returns**: `void`

#### `update_cell(filePath: string, sheetName: string, row: number, col: number, value: DataValue)`
Update single cell (legacy)
- **Parameters**:
  - `filePath`: Excel file path
  - `sheetName`: Target sheet name
  - `row`: Row index (0-based)
  - `col`: Column index (0-based)
  - `value`: New cell value
- **Returns**: `void`

### Project Notes

#### `save_project_notes(projectId: string, notes: string)`
Save notes for a project
- **Parameters**:
  - `projectId`: Project identifier
  - `notes`: Note text
- **Returns**: `void`

#### `load_project_notes(projectId: string)`
Load notes for a project
- **Parameters**:
  - `projectId`: Project identifier
- **Returns**: `string` - Note text

### File Dialog

#### `open_file_dialog()`
Open native file picker dialog
- **Returns**: `string | null` - Selected file path
- **Requires**: dialog plugin permissions

## Database Functions (SQLite)

### Initialization

#### `initDatabase()`
Initialize database and run migrations
- **Creates tables**: notes, kanban_cards, data_cache, pivot_cache
- **Returns**: `Promise<void>`
- **Called**: On app startup

### Data Cache Operations

#### `saveDataCache(cacheType: string, data: any, sourceFiles?: string[])`
Save data to cache with expiry
- **Parameters**:
  - `cacheType`: Cache identifier (e.g., 'pt_data', 'pivot_data')
  - `data`: Data to cache (will be JSON stringified)
  - `sourceFiles`: Optional source file names
- **Expiry**: 7 days from creation
- **Returns**: `Promise<void>`

#### `loadDataCache(cacheType: string)`
Load data from cache if valid
- **Parameters**:
  - `cacheType`: Cache identifier
- **Returns**: `Promise<any | null>` - Parsed data or null if expired/missing
- **Note**: Automatically checks expiry date

#### `clearDataCache()`
Clear all cached data
- **Returns**: `Promise<void>`
- **Used by**: Force Reload functionality

### Pivot Cache Operations

#### `savePivotCache(pivotType: string, data: any)`
Save calculated pivot table
- **Parameters**:
  - `pivotType`: Pivot identifier (e.g., 'pt_by_activity')
  - `data`: Pivot calculation results
- **Expiry**: 7 days
- **Returns**: `Promise<void>`

#### `loadPivotCache(pivotType: string)`
Load cached pivot calculations
- **Parameters**:
  - `pivotType`: Pivot identifier
- **Returns**: `Promise<any | null>`

### Project Notes Database

#### `saveNote(projectId: string, noteText: string)`
Save/update project note
- **Parameters**:
  - `projectId`: Project identifier
  - `noteText`: Note content
- **Returns**: `Promise<void>`

#### `loadNote(projectId: string)`
Load project note
- **Parameters**:
  - `projectId`: Project identifier
- **Returns**: `Promise<ProjectNote | null>`

#### `deleteNote(projectId: string)`
Delete project note
- **Parameters**:
  - `projectId`: Project identifier
- **Returns**: `Promise<void>`

### Kanban Operations

#### `saveKanbanCard(card: KanbanCard)`
Create/update kanban card
- **Parameters**:
  - `card`: Card object with id, title, description, status
- **Returns**: `Promise<void>`

#### `loadKanbanCards(projectId?: string)`
Load kanban cards
- **Parameters**:
  - `projectId`: Optional filter by project
- **Returns**: `Promise<KanbanCard[]>`

#### `deleteKanbanCard(cardId: string)`
Delete kanban card
- **Parameters**:
  - `cardId`: Card identifier
- **Returns**: `Promise<void>`

## Custom Events

### `forceReloadData`
Trigger complete data reload from Excel files
```javascript
window.dispatchEvent(new CustomEvent('forceReloadData'));
```
- **Effect**: Clears cache, reloads all Excel files
- **Duration**: ~3-5 seconds

### `settingsUpdated`
Notify components of settings changes
```javascript
window.dispatchEvent(new CustomEvent('settingsUpdated', {
  detail: { hiddenTabs: ['pipeline', 'vacation'] }
}));
```
- **Detail**: Settings that changed
- **Listeners**: Navigation components

### `dataLoadingProgress`
Track data loading progress
```javascript
window.addEventListener('dataLoadingProgress', (event) => {
  console.log(event.detail.progress); // { pFile: 50, ptFile: 100, ... }
  console.log(event.detail.isLoading); // true/false
});
```
- **Detail.progress**: Loading percentage per file
- **Detail.isLoading**: Overall loading state

## Global Functions

### `window.getGlobalDataCache()`
Access in-memory data cache
```javascript
const cache = window.getGlobalDataCache();
if (cache?.pt) {
  // Use PT data
}
```
- **Returns**: `GlobalDataCache | null`
- **Available after**: Initial data load

### `window.clearDataCache()`
Clear in-memory cache
```javascript
window.clearDataCache();
```
- **Effect**: Sets globalDataCache to null
- **Use with**: Force reload

## LocalStorage Keys

### Settings
- `appSettings` - Main application settings
- `hiddenTabs` - Hidden dashboard tabs
- `showTooltips` - Tooltip preference
- `dataFilePaths` - Excel file paths
- `lastAuthDate` - Authentication date
- `projectLocations` - Map markers

### Cache Indicators
- `lastDataRefresh` - Last refresh timestamp
- `cacheVersion` - Cache schema version

## HTTP Endpoints

*Note: This is a desktop app - no HTTP endpoints. All communication via Tauri IPC.*

## Error Codes

### Excel Errors
- `EXCEL_FILE_NOT_FOUND` - File doesn't exist
- `EXCEL_PARSE_ERROR` - Failed to parse Excel
- `EXCEL_SHEET_NOT_FOUND` - Sheet name not found
- `EXCEL_WRITE_ERROR` - Cannot write to file

### Database Errors
- `DB_INIT_ERROR` - Database initialization failed
- `DB_MIGRATION_ERROR` - Migration failed
- `DB_QUERY_ERROR` - Query execution failed
- `DB_CACHE_EXPIRED` - Cache has expired

### Validation Errors
- `INVALID_PROJECT_ID` - Project ID not found
- `INVALID_ACTIVITY_SEQ` - Activity sequence invalid
- `INVALID_DATE_RANGE` - Date range invalid

## Rate Limits

### File Operations
- Excel read: No limit (but ~1-2 seconds per file)
- Excel write: Queued to prevent corruption
- File dialog: One at a time

### Database Operations
- No query limits
- Cache writes: Batched for performance
- Vacuum: Weekly recommended

## Migration Guide

### From v1 (Excel only) to v2 (SQL cache)
1. Data automatically migrates on first load
2. Cache expires after 7 days
3. Force reload available anytime
4. Old localStorage settings preserved

---
*Last Updated: January 2025*
*Version: 2.0*