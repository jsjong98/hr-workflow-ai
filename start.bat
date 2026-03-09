@echo off
chcp 65001 >nul 2>&1
title HR Workflow Builder
:: =====================================================
::  HR Workflow Builder - Windows 실행 파일
::  이 파일을 더블클릭하면 자동으로 설치 및 실행됩니다.
:: =====================================================

cd /d "%~dp0"

echo.
echo =====================================================
echo   HR Workflow Builder - 시작 중...
echo =====================================================
echo.

:: -- 1. Node.js 확인 --
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js 가 설치되어 있지 않습니다.
    echo.
    echo   아래 주소에서 Node.js LTS 버전을 설치하세요:
    echo   ^>^> https://nodejs.org/ko
    echo.
    echo   설치 후 이 파일을 다시 더블클릭하세요.
    echo.
    start https://nodejs.org/ko
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [확인] Node.js %NODE_VER%

:: -- 2. npm 확인 --
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] npm 을 찾을 수 없습니다. Node.js 를 다시 설치하세요.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo [확인] npm v%NPM_VER%

:: -- 3. 패키지 설치 (최초 1회) --
if not exist "node_modules" (
    echo.
    echo [설치] 패키지 설치 중... ^(최초 실행 시 2~3분 소요^)
    echo.
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo.
        echo [오류] 패키지 설치 실패. 인터넷 연결을 확인하세요.
        pause
        exit /b 1
    )
    echo.
    echo [완료] 패키지 설치 완료
) else (
    echo [확인] 패키지 이미 설치됨
)

:: -- 4. 브라우저 자동 열기 (3초 후) --
start /b "" cmd /min /c "timeout /t 3 /nobreak >nul 2>&1 && start http://localhost:3000"

:: -- 5. 서버 시작 --
echo.
echo =====================================================
echo   서버 시작 완료!
echo   주소: http://localhost:3000
echo   종료: 이 창을 닫거나 Ctrl+C
echo =====================================================
echo.

call npx next dev --turbopack -p 3000

:: -- 서버 종료 시 --
echo.
echo [종료] 서버가 중지되었습니다.
pause
