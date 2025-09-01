# Grid Connection Program Management Dashboard

A comprehensive Tauri v2 application for managing grid connection projects, budgets, resources, and deliverables with SQL database integration for caching and persistence.

## 🚀 Latest Features (January 2025)

### Core Architecture
- **Hybrid Data Model**: Excel files as read-only source of truth + SQLite for caching and user data
- **Persistent Caching**: 7-day cache expiry for weekly refresh cycles
- **SQL Database Integration**: Stores pivot tables, notes, kanban cards, and cached Excel data
- **Real-time Status Indicators**: Shows data loading state and last refresh time
- **System Diagnostics**: Comprehensive health checks for all components

### Recent Fixes & Improvements
- ✅ Force Reload properly clears cache and reloads from Excel
- ✅ Program Management uses "Program Quick View" sheet
- ✅ Pipeline data correctly accessed from cache
- ✅ Project Map themed to match UI (blue/white)
- ✅ Settings shows cached data on startup
- ✅ Diagnostics tab for system health monitoring

## 📊 Dashboard Modules

### Core Analytics
- **📊 Projects Dashboard** - View all active projects with financial summaries
- **💰 Budget Tracker** - Monitor budget vs actual with T&E calculations
- **⚠️ Budget Alerts** - Track activities exceeding 90% budget threshold
- **⏱️ Hours Tracking** - Analyze hours by project, activity, and employee
- **💵 Revenue Analysis** - Compare T&E vs Fixed revenue streams

### Planning & Management
- **🔄 Pipeline Manager** - Track project lifecycle stages (headers in row 11)
- **📈 Program Management** - Executive oversight with RAG status ratings
- **🗺️ Project Map** - Interactive map with project locations
- **🏖️ Vacation Planner** - Team availability and resource planning

### Configuration & Tools
- **⚙️ Settings** - Multi-tab configuration center
  - General: Tab visibility, tooltips
  - File Paths: Excel file configuration with browse buttons
  - Users: User management and permissions
  - Inspector: Data source mapping visualization
  - Pivot Tables: Cached pivot calculations (5-row preview)
  - **🔧 Diagnostics**: System health checks
- **📁 Data Source Tooltips** - Hover to see where data comes from

## 🗄️ Data Architecture

### Excel Files (Read-Only Source)
```
/data/
├── P.xlsx              # Projects master data
├── PT.xlsx             # Project transactions (actuals)
├── AE.xlsx             # Activity estimates (budgets)
└── Program_Management.xlsm  # Pipeline, Program, Vacation data
```

### SQLite Database (grid_connection.db)
```sql
-- User-generated content
notes                   # Project notes
kanban_cards           # Kanban board cards

-- Cache tables
data_cache             # Excel data with 7-day expiry
pivot_cache            # Calculated pivot tables
```

### Data Flow
1. **Initial Load**: Check SQL cache → Load from cache if valid
2. **Cache Miss**: Load from Excel → Calculate → Store in SQL
3. **Force Reload**: Clear cache → Load fresh from Excel → Update cache
4. **Weekly Refresh**: Automatic cache expiry after 7 days

## 📋 Calculation Rules

### Budget Calculations
```
Actual_Spent = SUM(PT[Internal_Amount]) WHERE Status != "Closed"
Budget_Remaining = Project_Budget - Actual_Spent
Utilization = (Actual_Spent / Project_Budget) * 100
```

### T&E vs Fixed Revenue
```
T&E_Revenue = SUM(PT[Sales_Amount]) WHERE Type = "T&E"
Fixed_Revenue = SUM(PT[Sales_Amount]) WHERE Type = "Fixed"
Revenue_Mix = T&E_Revenue / Total_Revenue * 100
```

### Key Column Mappings
- **PT.xlsx**: 
  - Column S: Internal Hours
  - Column Y: Internal Cost
  - Column AH: Sales Revenue
- **Pipeline Sheet**: Headers in row 11 (not row 1)
- **Program Sheet**: Uses "Program Quick View" tab

## 🛠️ Installation

### Prerequisites
- Node.js v18+
- Rust (via [rustup.rs](https://rustup.rs/))
- Platform-specific:
  - **Windows**: Visual Studio Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: GTK development packages

### Quick Start
```bash
# Clone repository
git clone <repository-url>
cd "Program Management"

# Install dependencies
npm install

# Run in development
npm run tauri dev

# Build for production
npm run tauri build
```

## 🔧 System Diagnostics

The Diagnostics tab (Settings → Diagnostics) checks:
1. **SQLite Database** - Connection and table verification
2. **Excel Files** - File path configuration
3. **Data Cache** - Cache validity and age
4. **Global Data Store** - In-memory cache status
5. **File Permissions** - Read/write access
6. **Tauri Backend** - Rust backend health
7. **Settings Storage** - LocalStorage access
8. **Event System** - Custom event propagation
9. **Memory Usage** - JavaScript heap monitoring
10. **Data Integrity** - Cache expiry validation

## 📁 Project Structure
```
/
├── src/                    # React frontend
│   ├── components/         # Reusable components
│   ├── services/          # Database and data services
│   └── config/            # Data source mappings
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── lib.rs        # Tauri commands
│   │   └── excel.rs      # Excel processing
│   └── capabilities/      # Permissions config
├── data/                  # Excel data files
└── CALCULATION_RULES.md   # Business logic documentation
```

## 🔐 Security & Permissions

### Tauri Capabilities (capabilities/default.json)
- `dialog:default` - File browser dialogs
- `sql:default` - SQLite database access
- `core:event` - Custom event system

### Default Credentials
- Password: `tiinos2025` (changeable in Settings)
- Authentication persists for current day only

## 🐛 Troubleshooting

### Common Issues
1. **"No data loaded" message**: Click "Force Reload Data" in Settings
2. **Pipeline data not showing**: Check Excel has "Pipeline" sheet with headers in row 11
3. **Browse buttons not working**: Ensure Tauri dialog plugin permissions are set
4. **Pivot tables empty**: Verify PT.xlsx and AE.xlsx are loaded

### Developer Console Access
- **macOS/Linux**: Right-click → Inspect Element
- **Windows**: F12 or right-click → Inspect

## 📚 Documentation
- `CALCULATION_RULES.md` - Detailed business logic and formulas
- `data/README.md` - Data file requirements
- `src/config/dataSourceMapping.ts` - Column mappings

## 🤝 Contributing
1. Never modify without explicit user request
2. Preserve all existing functionality
3. Test with actual Excel files before committing
4. Update documentation for new features

## 📝 License
Proprietary - Tiinos Grid Connection Program

---
*Built with Tauri v2, React, TypeScript, and SQLite*