@echo off
REM Start Local RAG Development Servers
REM Double-click this file or run from command prompt

cd /d "%~dp0"

echo Stopping existing processes...

REM Kill processes on port 8000 (backend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Kill processes on port 3000 (frontend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul

REM Start Backend
start "Local RAG Backend" powershell -NoExit -Command "cd '%~dp0backend'; .\.venv\Scripts\Activate.ps1; Write-Host '🚀 Starting Backend Server...' -ForegroundColor Cyan; uvicorn main:app --reload --port 8000"

REM Start Frontend
start "Local RAG Frontend" powershell -NoExit -Command "cd '%~dp0frontend'; Write-Host '🎨 Starting Frontend Server...' -ForegroundColor Magenta; npm run dev"

echo.
echo ✅ Dev servers starting in separate windows!
echo    Backend:  http://localhost:8000
echo    Frontend: http://localhost:3000
echo.
