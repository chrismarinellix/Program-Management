# Cross-Platform Setup Guide

This application works on Windows, macOS, and Linux.

## Prerequisites

### All Platforms
- **Node.js** v18 or higher
- **npm** (comes with Node.js)
- **Git** for cloning the repository

### Windows Specific
1. **Rust** - Install from [rustup.rs](https://rustup.rs/)
2. **Visual Studio Build Tools 2019 or 2022**
   - Download from [Microsoft](https://visualstudio.microsoft.com/downloads/)
   - Select "Desktop development with C++" workload
3. **WebView2** (usually pre-installed on Windows 10/11)

### macOS Specific
1. **Rust** - Install via Terminal:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. **Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```

### Linux Specific
1. **Rust** - Install from [rustup.rs](https://rustup.rs/)
2. **Development packages**:
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev
   
   # Fedora
   sudo dnf install gtk3-devel webkit2gtk4.0-devel libappindicator-gtk3-devel librsvg2-devel
   ```

## Installation Steps

### 1. Clone the Repository
```bash
# Windows (PowerShell/CMD)
git clone [repository-url]
cd stock-visualizer

# macOS/Linux
git clone [repository-url]
cd stock-visualizer
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Data Files

The application expects Excel files in the `data` folder:

```
stock-visualizer/
├── data/
│   ├── P.xlsx        # Projects master data
│   ├── PT.xlsx       # Project transactions
│   ├── AE.xlsx       # Activities estimates
│   └── Program_Management.xlsm  # Program management
```

**Option 1:** Copy your Excel files to the `data` folder

**Option 2:** Update file paths in the Settings tab after launching the app

### 4. Run Development Server
```bash
npm run tauri dev
```

### 5. Build for Production
```bash
# Windows - Creates .msi installer
npm run tauri build

# macOS - Creates .dmg
npm run tauri build

# Linux - Creates .deb and .AppImage
npm run tauri build
```

## File Path Configuration

Default paths are relative to the application directory:
- `./data/P.xlsx`
- `./data/PT.xlsx`
- `./data/AE.xlsx`
- `./data/Program_Management.xlsm`

To change paths:
1. Launch the application
2. Go to Settings tab (⚙️)
3. Update "Data File Paths" section
4. Click "Save Settings"

## Troubleshooting

### Windows Issues

**Error: "cargo not found"**
- Solution: Restart terminal after Rust installation or add cargo to PATH manually

**Error: "Failed to find Visual Studio"**
- Solution: Install Visual Studio Build Tools with C++ workload

### macOS Issues

**Error: "xcrun: error: invalid active developer path"**
- Solution: Run `xcode-select --install`

### Linux Issues

**Error: "Package gtk+-3.0 was not found"**
- Solution: Install GTK development packages (see Linux prerequisites)

### All Platforms

**Error: "Excel file not found"**
- Solution: Check file paths in Settings or copy files to `data` folder

**Performance Issues**
- Large Excel files may take time to load
- Consider splitting very large datasets

## Data File Structure

Ensure your Excel files have the correct structure:

### P.xlsx (Projects)
- Row 1: Headers
- Column A: Project ID
- Column B: Project Name
- Additional project metadata

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
- Headers location varies by sheet
- Pipeline sheet: Row 11
- Program sheet: Row 3
- Vacation sheet: Row 1

## Support

For issues or questions:
1. Check the console for error messages (F12 in the app)
2. Verify all Excel files are in place
3. Ensure file permissions allow reading
4. Check that Rust and Node.js versions meet requirements