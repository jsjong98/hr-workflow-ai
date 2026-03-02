@echo off
:: =====================================================
::  Strategy& Workflow Builder - Quick Start (Windows)
:: =====================================================

cd /d "%~dp0"

echo.
echo =====================================================
echo   Strategy and Workflow Builder - Starting...
echo =====================================================
echo.

:: -- 1. Check Node.js --
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo.
    echo Please install Node.js LTS from:
    echo   https://nodejs.org/
    echo.
    echo After installation, double-click this file again.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER% detected.

:: -- 2. Check npm --
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found. Please reinstall Node.js.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo [OK] npm v%NPM_VER% detected.

:: -- 3. Install dependencies if needed --
if not exist "node_modules" (
    echo.
    echo [INFO] Installing dependencies (first run)...
    echo       This may take a few minutes...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Check your network connection.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed successfully.
) else (
    echo [OK] Dependencies already installed.
)

:: -- 4. Check .env.local --
if not exist ".env.local" (
    echo.
    echo [WARNING] .env.local file not found.
    echo          AI Chat feature requires an OpenAI API key.
    echo          Create .env.local with:
    echo            OPENAI_API_KEY=sk-your-key-here
    echo.
)

:: -- 5. Start dev server --
echo.
echo =====================================================
echo   Starting development server...
echo   URL: http://localhost:3000
echo =====================================================
echo.
echo   Press Ctrl+C to stop the server.
echo.

call npx next dev --turbopack -p 3000

:: -- If server stops --
echo.
echo [INFO] Server has stopped.
pause
