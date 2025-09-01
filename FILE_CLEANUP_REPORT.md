# File Cleanup Report - Grid Connection Dashboard

## 🔴 Files with Conflicts/Duplicates

### Documentation Files (.md)

#### 1. **DUPLICATES TO REMOVE**
- **CALCULATIONS.md** - Duplicate of CALCULATION_RULES.md content
  - Status: Outdated, contains old calculation logic
  - Action: DELETE (content already in CALCULATION_RULES.md)

- **PROJECT_README.md** - Wrong project! 
  - Status: Contains "Stock Visualizer & Trading Platform" info
  - Action: DELETE (not related to this project)

- **SQL_INTEGRATION_PLAN.md** - Outdated planning document
  - Status: Old plan, now implemented
  - Action: DELETE (implementation complete, documented in README.md)

#### 2. **FILES TO KEEP**
- **README.md** ✅ - Main project documentation (just updated)
- **CALCULATION_RULES.md** ✅ - Business logic (just updated)
- **DEVELOPMENT_GUIDELINES.md** ✅ - Important dev rules
- **CROSS_PLATFORM_SETUP.md** ✅ - Platform-specific setup
- **WINDOWS_SETUP.md** ✅ - Windows-specific instructions
- **TROUBLESHOOTING.md** ✅ - Common issues and solutions
- **data/README.md** ✅ - Data directory guide

### Source Code Files

#### 3. **OLD/BACKUP FILES TO REMOVE**
- **src/PivotTables_old.tsx** - Old version before SQL integration
  - Action: DELETE (current version works with SQL caching)

- **src/Settings_old.tsx** - Old version before tabs were added
  - Action: DELETE (current version has all features)

## 📊 Summary

### Files to Delete (5):
```bash
# Documentation conflicts
rm CALCULATIONS.md           # Duplicate content
rm PROJECT_README.md         # Wrong project
rm SQL_INTEGRATION_PLAN.md   # Outdated plan

# Old source files
rm src/PivotTables_old.tsx   # Backup no longer needed
rm src/Settings_old.tsx       # Backup no longer needed
```

### Files to Keep (7):
- README.md (main documentation)
- CALCULATION_RULES.md (business logic)
- DEVELOPMENT_GUIDELINES.md (coding standards)
- CROSS_PLATFORM_SETUP.md (cross-platform guide)
- WINDOWS_SETUP.md (Windows setup)
- TROUBLESHOOTING.md (troubleshooting guide)
- data/README.md (data directory info)

## 🎯 Recommended Actions

1. **Delete the 5 conflicting files** to avoid confusion
2. **Keep the 7 essential documentation files** 
3. **No other naming conflicts found** in the codebase

## ✅ Clean File Structure After Cleanup

```
/Program Management/
├── README.md                    # Main project docs
├── CALCULATION_RULES.md         # Business logic
├── DEVELOPMENT_GUIDELINES.md    # Dev standards
├── CROSS_PLATFORM_SETUP.md     # Platform setup
├── WINDOWS_SETUP.md            # Windows specific
├── TROUBLESHOOTING.md          # Common issues
├── data/
│   └── README.md              # Data directory guide
├── src/                       # All source files (no _old files)
└── src-tauri/                 # Rust backend
```

This cleanup will:
- Remove confusion from duplicate documentation
- Eliminate outdated planning documents
- Remove unnecessary backup files
- Keep only current, relevant documentation