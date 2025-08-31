# Program Management - Windows Build Script (PowerShell)
# Run with: .\build-windows.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Program Management - Windows Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-Command {
    param($Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (!(Test-Command "node")) {
    Write-Host "ERROR: Node.js is not installed" -ForegroundColor Red
    Write-Host "Please install from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

if (!(Test-Command "cargo")) {
    Write-Host "ERROR: Rust/Cargo is not installed" -ForegroundColor Red
    Write-Host "Please install from: https://rustup.rs/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Display versions
Write-Host "✓ Node.js version: " -NoNewline -ForegroundColor Green
node --version
Write-Host "✓ Cargo version: " -NoNewline -ForegroundColor Green
cargo --version

Write-Host ""
Write-Host "[1/4] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[2/4] Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "src-tauri\target\release\bundle") {
    Remove-Item -Recurse -Force "src-tauri\target\release\bundle"
}

Write-Host ""
Write-Host "[3/4] Building application..." -ForegroundColor Yellow
Write-Host "This may take 5-10 minutes on first run..." -ForegroundColor Cyan
npm run tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[4/4] Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Output files:" -ForegroundColor Yellow
Write-Host ""

# Find and display MSI file
$msiPath = Get-ChildItem -Path "src-tauri\target\release\bundle\msi\" -Filter "*.msi" -ErrorAction SilentlyContinue
if ($msiPath) {
    Write-Host "Installer: " -ForegroundColor Green
    Write-Host "  $($msiPath.FullName)" -ForegroundColor White
    Write-Host ""
}

# Find and display EXE file
$exePath = "src-tauri\target\release\program-management.exe"
if (Test-Path $exePath) {
    $exeSize = (Get-Item $exePath).Length / 1MB
    Write-Host "Executable: " -ForegroundColor Green
    Write-Host "  $exePath" -ForegroundColor White
    Write-Host "  Size: $([math]::Round($exeSize, 2)) MB" -ForegroundColor Gray
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run the MSI installer to install the application" -ForegroundColor White
Write-Host "2. Or copy the .exe file for a portable version" -ForegroundColor White
Write-Host "3. Place your Excel files in the 'data' folder" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"