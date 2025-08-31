# Windows Setup Guide for Program Management

## Prerequisites for Windows

### Required Software

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Choose the LTS version
   - The installer will also install npm

2. **Rust**
   - Download from: https://www.rust-lang.org/tools/install
   - Or direct link: https://win.rustup.rs/
   - Run the installer and follow prompts
   - This installs `rustup`, `cargo`, and `rustc`

3. **Visual Studio Build Tools 2022**
   - Download from: https://visualstudio.microsoft.com/downloads/
   - Scroll down to "Tools for Visual Studio"
   - Download "Build Tools for Visual Studio 2022"
   - During installation, select:
     - ✅ Desktop development with C++
     - ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools
     - ✅ Windows 10/11 SDK

4. **WebView2** (Usually pre-installed on Windows 10/11)
   - If not installed, download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

## Installation Steps

### 1. Clone the Repository

Open Command Prompt or PowerShell:

```powershell
# Option 1: Using Git
git clone https://github.com/chrismarinellix/Program-Management.git
cd Program-Management

# Option 2: Download ZIP from GitHub
# Extract to C:\Users\YourName\Documents\Program-Management
```

### 2. Install Dependencies

```powershell
# In the project directory
npm install
```

### 3. Set Up Data Files

Create a `data` folder in the project root and add your Excel files:

```
Program-Management\
├── data\
│   ├── P.xlsx
│   ├── PT.xlsx
│   ├── AE.xlsx
│   └── Program_Management.xlsm
```

Or use the Settings tab in the app to configure custom file paths.

### 4. Run Development Version

```powershell
npm run tauri dev
```

The application will:
- Compile the Rust backend (first run takes a few minutes)
- Start the development server
- Open the application window

### 5. Build for Production

```powershell
# Creates an MSI installer
npm run tauri build
```

The installer will be created in:
`src-tauri\target\release\bundle\msi\Program Management_0.1.0_x64_en-US.msi`

## Troubleshooting

### Common Issues

#### "cargo not found"
**Solution:**
1. Close all terminals
2. Re-run Rust installer
3. Restart computer
4. Open new terminal and try again

#### "error: Microsoft Visual C++ 14.0 or greater is required"
**Solution:**
1. Install Visual Studio Build Tools 2022
2. Make sure to select "Desktop development with C++" workload
3. Restart terminal after installation

#### "cannot find -lwebview2"
**Solution:**
1. Install WebView2 Runtime
2. Restart the computer
3. Try building again

#### "Error: spawn npm ENOENT"
**Solution:**
1. Ensure Node.js is installed
2. Restart terminal
3. Run `npm --version` to verify installation

### File Path Issues

Windows uses backslashes (`\`) for paths. The app automatically handles this, but if you manually edit paths in Settings:

**Correct:** `C:\Users\YourName\Documents\data\P.xlsx`
**Also works:** `C:/Users/YourName/Documents/data/P.xlsx`

### Performance Tips

1. **Antivirus:** Add the project folder to Windows Defender exclusions for faster builds
2. **First build:** The initial build takes 5-10 minutes. Subsequent builds are much faster
3. **RAM:** Close other applications during build if you have less than 8GB RAM

## Running the Installed Application

After building:

1. **Install:** Double-click the `.msi` file in `src-tauri\target\release\bundle\msi\`
2. **Run:** Find "Program Management" in Start Menu
3. **Data:** Place Excel files in:
   - Application directory's `data` folder, or
   - Configure paths in Settings

## Creating a Portable Version

If you prefer not to install:

1. After running `npm run tauri build`
2. Find the `.exe` file in `src-tauri\target\release\`
3. Copy `program-management.exe` to any folder
4. Create a `data` subfolder next to the exe
5. Add your Excel files
6. Run the exe directly

## Network/Firewall

The application is completely offline and doesn't require internet access. If Windows Firewall prompts appear, you can safely block network access as the app only reads local Excel files.

## Updating

To update to a newer version:

1. Pull latest changes:
   ```powershell
   git pull origin main
   npm install
   npm run tauri build
   ```

2. Uninstall old version (if installed via MSI)
3. Install new MSI

## Support

For Windows-specific issues:
1. Check the console (F12 in the app) for errors
2. Verify all prerequisites are installed
3. Try running as Administrator if file access issues occur
4. Ensure Excel files aren't open in another program