@echo off
title Yadam Storyboard Engine Runner
chcp 65001 > NUL
echo =======================================================
echo     야담 스토리보드 제어 엔진 - 로컬 실행기 (Windows)
echo =======================================================
echo.

:: Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다!
    echo https://nodejs.org/ 에서 LTS 버전을 설치한 후 다시 실행해주세요.
    echo.
    pause
    exit /b
)

:: Automatically install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo [안내] 첫 실행을 감지했습니다. 필요한 패키지들을 설치합니다...
    echo       (이 작업은 1~2분이 소요될 수 있습니다.)
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [오류] 패키지 설치 중 오류가 발생했습니다.
        pause
        exit /b
    )
    echo.
    echo [완료] 패키지 설치가 완료되었습니다.
    echo.
)

:: Start the development server
echo [실행] 야담 스토리보드 제어 엔진을 로컬 서버(Port 3000)로 시작합니다...
echo.
echo * 잠시 후 브라우저가 자동으로 열립니다: http://localhost:3000
echo.

:: Open browser after a short delay (2 seconds)
start "" "http://localhost:3000"

:: Run the dev server
call npm run dev

pause
