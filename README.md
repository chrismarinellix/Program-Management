# Program Management Tool

A comprehensive program management application for tracking projects, budgets, resources, and deliverables.

## Features

### Core Modules
- **📊 Projects Dashboard** - View all active projects with financial summaries
- **💰 Budget Tracker** - Monitor budget vs actual spending with T&E calculations
- **⚠️ Budget Alerts** - Track activities exceeding budget thresholds
- **⏱️ Hours Tracking** - Analyze hours by project, activity, and time period
- **💰 Revenue Analysis** - Compare T&E vs Fixed revenue streams

### Planning & Management
- **🔄 Pipeline Manager** - Track project lifecycle stages
- **📈 Program Management** - Executive oversight with RAG ratings
- **🗺️ Project Map** - Visual project locations on interactive map
- **🏖️ Vacation Planner** - Team availability and resource planning

### Settings & Configuration
- **⚙️ Settings** - User management, file paths, access control
- **📋 Data Inspector** - View data sources and column mappings
- **📊 Pivot Tables** - In-memory pivot calculations

## Installation

### Prerequisites
- Node.js v18+
- Rust (install from [rustup.rs](https://rustup.rs/))
- **Windows:** Visual Studio Build Tools (see WINDOWS_SETUP.md)
- **macOS:** Xcode Command Line Tools
- **Linux:** GTK development packages (see CROSS_PLATFORM_SETUP.md)

### Quick Start

#### Windows
```powershell
# Clone the repository
git clone https://github.com/chrismarinellix/Program-Management.git
cd Program-Management

# Install dependencies
npm install

# Run development version
npm run tauri dev

# Or build installer (creates .msi file)
.\build-windows.ps1
# Or use: build-windows.bat
```

#### macOS/Linux
```bash
# Clone the repository
git clone https://github.com/chrismarinellix/Program-Management.git
cd "Program Management"

# Install dependencies
npm install

# Run development server
npm run tauri dev

# Build for production
npm run tauri build
```

### Data Setup
Place Excel files in the `data/` folder:
- P.xlsx (Projects master)
- PT.xlsx (Transactions)
- AE.xlsx (Estimates)
- Program_Management.xlsm

## Data Structure

The application expects specific Excel file formats:

### P.xlsx (Projects)
- Row 1: Headers
- Key columns: Project ID, Name, Status

### PT.xlsx (Transactions)
- Row 1: Headers  
- Column E: Activity Seq
- Column H: Project Description
- Column L: Activity Description
- Column S: Internal Quantity (Hours)
- Column Y: Internal Amount (Cost)
- Column AH: Sales Amount (Revenue)

### AE.xlsx (Estimates)
- Row 1: Headers
- Column S: Activity Seq
- Column K: Estimated Cost
- Column L: Estimated Revenue
- Column M: Estimated Hours

### Program_Management.xlsm
- Different header rows per sheet
- Pipeline: Row 11
- Program: Row 3
- Vacation: Row 1

## Configuration

### File Paths
Default data directory: `./data/`

To change file locations:
1. Open Settings tab
2. Update Data File Paths
3. Save Settings

### User Access
1. Settings → User Management
2. Add users with specific permissions
3. Control tab visibility per user role

## Cross-Platform Support

Works on Windows, macOS, and Linux. See CROSS_PLATFORM_SETUP.md for detailed platform-specific instructions.

## Security Features
- Password-protected settings
- Role-based access control
- Hidden tab management
- Secure data file paths

## Technologies
- **Frontend**: React, TypeScript
- **Backend**: Rust, Tauri
- **Data Processing**: Calamine (Excel reading)
- **Maps**: Leaflet, OpenStreetMap
- **State Management**: LocalStorage, React hooks

## License
Private - All rights reserved

## Support
For issues or questions, please contact the development team.