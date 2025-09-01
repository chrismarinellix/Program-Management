# Claude AI - Project-Specific Instructions

## ⚠️ AUTOMATIC SAFETY PROTOCOL
**ALWAYS perform impact analysis before making changes:**
1. Check what components will be affected
2. List potential breaking changes
3. Warn user of risks
4. Only proceed after analysis

## 🎯 Project Overview
**Grid Connection Program Management Dashboard**
- Tauri v2 desktop app for managing grid connection projects
- Hybrid architecture: Excel files (read-only source) + SQLite (cache & user data)
- Production system for Tiinos - handle with care

## ⚠️ CRITICAL RULES - NEVER VIOLATE
1. **NEVER** make changes without explicit user request
2. **NEVER** remove or modify existing functionality unless asked
3. **ALWAYS** preserve backward compatibility
4. **ALWAYS** test with actual Excel files before committing
5. **NEVER** modify Excel files directly - they are read-only source of truth

## 📁 Key Files & Their Purpose
```
README.md                 → Project overview, installation
CALCULATION_RULES.md      → Business logic, formulas (DO NOT CHANGE without request)
dataSourceMapping.ts      → Column mappings (CRITICAL - verify before using)
database.ts              → SQL functions (cache has 7-day expiry)
GridConnectionDashboard  → Main container (handles all data loading)
```

## 🗺️ Data Flow Architecture
```
Excel Files → Tauri Backend → SQL Cache → Global Data Cache → React Components
    ↑                              ↓
    └── Force Reload ←─────────────┘ (Clears cache, reloads from Excel)
```

## 📊 Known Data Quirks - MEMORIZE THESE

### Excel Sheet Mappings
| File | Sheet | Header Row | Critical Notes |
|------|-------|------------|----------------|
| P.xlsx | Projects | 1 | Project master data |
| PT.xlsx | Transactions | 1 | Column AH = Revenue (NOT AI!) |
| AE.xlsx | Estimates | 1 | Activity Seq links to PT |
| Program_Management.xlsm | Pipeline | **11** | ⚠️ Headers in row 11, not 1! |
| Program_Management.xlsm | **Program Quick View** | **3** | ⚠️ NOT "Program" sheet! |
| Program_Management.xlsm | Vacation | 1 | Team availability |

### Column Mappings (PT.xlsx)
- Column E: Activity Seq (links PT to AE)
- Column S: Internal Hours
- Column Y: Internal Cost
- Column AH: Sales Revenue (**NOT column AI**)

## 🔧 Common Operations

### Adding a New Feature
1. Check if similar feature exists in codebase
2. Use existing patterns from similar components
3. Add to dataSourceMapping.ts if new data source
4. Update CALCULATION_RULES.md if new calculations
5. Test with actual Excel files

### Fixing Data Issues
1. Check SQL cache first: `loadDataCache()`
2. If stale, check Force Reload functionality
3. Verify Excel sheet names and header rows
4. Check column mappings in dataSourceMapping.ts

### Updating Calculations
1. Read CALCULATION_RULES.md first
2. Verify Excel column mappings
3. Test with edge cases ($0 budgets, closed projects)
4. Update pivot cache after changes

## 🐛 Common Pitfalls to Avoid

### ❌ DON'T DO THIS:
```javascript
// Wrong - Pipeline headers are not in row 1
const headers = pipelineSheet.rows[0];

// Wrong - Program sheet name
const programSheet = data.sheets.find(s => s.name === 'Program');

// Wrong - Revenue column
const revenue = row[34]; // Column AI
```

### ✅ DO THIS INSTEAD:
```javascript
// Correct - Pipeline headers are in row 11
const headers = pipelineSheet.headers; // Backend handles row 11

// Correct - Program Quick View sheet
const programSheet = data.program; // Already mapped correctly

// Correct - Revenue column AH
const revenue = row[33]; // Column AH (0-indexed)
```

## 🔄 State Management Patterns

### Global Data Cache
```javascript
// Access pattern - always check if exists
if (window.getGlobalDataCache) {
  const cache = window.getGlobalDataCache();
  if (cache?.pt) {
    // Use cached data
  }
}
```

### Force Reload Pattern
```javascript
// Must clear BOTH caches
globalDataCache = null;      // Clear memory
dataLoadPromise = null;      // Clear promise
clearDataCache();            // Clear SQL
loadAllDataOnce(true);       // Force reload
```

## 📝 Testing Checklist
Before committing any changes:
- [ ] Test with real Excel files (not mock data)
- [ ] Verify Force Reload still works
- [ ] Check pivot tables show data
- [ ] Confirm Pipeline/Program views load
- [ ] Test SQL cache persistence (restart app)
- [ ] Verify diagnostic checks pass

## 🚫 Areas Requiring Extra Caution
1. **Excel Processing** - Rust backend, don't modify without testing
2. **SQL Migrations** - Database schema changes need migration
3. **Pivot Calculations** - Complex aggregations, verify formulas
4. **Authentication** - Password: tiinos2025 (don't expose)
5. **File Paths** - Cross-platform compatibility required

## 💡 Quick Debug Commands
```javascript
// Check what data is loaded
console.log(window.getGlobalDataCache());

// Force reload data
window.dispatchEvent(new CustomEvent('forceReloadData'));

// Check SQL cache
await loadDataCache('pt_data');

// View column mappings
console.log(columnMappings['PT.xlsx']);
```

## 📚 Reference Priority
1. This file (CLAUDE.md) - Project-specific rules
2. CALCULATION_RULES.md - Business logic
3. dataSourceMapping.ts - Column mappings
4. README.md - General project info

---
**Remember**: This is a production system. Every change matters. Test thoroughly.