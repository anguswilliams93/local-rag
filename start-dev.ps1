# Start Local RAG Development Servers
# Run this script from the project root: .\start-dev.ps1

$projectRoot = $PSScriptRoot

Write-Host "🛑 Stopping existing processes..." -ForegroundColor Yellow

# Stop any existing uvicorn/python processes on port 8000
$backendPid = (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
if ($backendPid) {
    $backendPid | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Write-Host "   Stopped backend process(es)" -ForegroundColor Gray
}

# Stop any existing node processes on port 3000
$frontendPid = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
if ($frontendPid) {
    $frontendPid | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Write-Host "   Stopped frontend process(es)" -ForegroundColor Gray
}

Start-Sleep -Milliseconds 500

# Start Backend in new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\backend'; .\.venv\Scripts\Activate.ps1; Write-Host '🚀 Starting Backend Server...' -ForegroundColor Cyan; uvicorn main:app --reload --port 8000"

# Start Frontend in new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\frontend'; Write-Host '🎨 Starting Frontend Server...' -ForegroundColor Magenta; npm run dev"

Write-Host "✅ Dev servers starting in separate windows!" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Magenta
