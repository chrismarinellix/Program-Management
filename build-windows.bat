@echo off
echo ========================================
echo Program Management - Windows Build Script
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Rust is installed
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Rust/Cargo is not installed or not in PATH
    echo Please install Rust from https://rustup.rs/
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install npm dependencies
    pause
    exit /b 1
)

echo.
echo [2/4] Cleaning previous builds...
if exist "src-tauri\target\release\bundle" (
    rmdir /s /q "src-tauri\target\release\bundle"
)

echo.
echo [3/4] Building application...
echo This may take several minutes on first run...
call npm run tauri build
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo [4/4] Build complete!
echo.
echo ========================================
echo Installer location:
echo src-tauri\target\release\bundle\msi\
echo.
echo Executable location:
echo src-tauri\target\release\program-management.exe
echo ========================================
echo.
pause