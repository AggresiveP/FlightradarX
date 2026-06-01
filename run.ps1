# Swedavia FlightInfo Ultimate 3D Edition - Launch Script
# Run this script to easily setup and launch the application locally.

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Swedavia FlightInfo Ultimate 3D Edition Boot Sequence   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$pythonCmd = ""

# Test if 'python' is actually installed (bypasses Windows Store stubs)
try {
    $testPy = & python --version 2>$null
    if ($testPy -match "Python") {
        $pythonCmd = "python"
    }
}
catch {}

# If not found, check if 'py' launcher is installed
if (-not $pythonCmd) {
    try {
        $testPy = & py --version 2>$null
        if ($testPy -match "Python") {
            $pythonCmd = "py"
        }
    }
    catch {}
}

# If both are missing, guide the user on how to install Python
if (-not $pythonCmd) {
    Write-Host "----------------------------------------------------------" -ForegroundColor Red
    Write-Host "ERROR: Python 3 was not found on your system!" -ForegroundColor Red
    Write-Host "Please download and install Python (3.8+) from:" -ForegroundColor Yellow
    Write-Host "  👉 https://www.python.org/downloads/" -ForegroundColor Cyan
    Write-Host "IMPORTANT: During installation, make sure to check:" -ForegroundColor Yellow
    Write-Host "           [x] Add python.exe to PATH" -ForegroundColor Green
    Write-Host "----------------------------------------------------------" -ForegroundColor Red
    Exit
}

Write-Host "Using Python executable: $pythonCmd" -ForegroundColor Green

# Create virtual environment if it doesn't exist
if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python Virtual Environment (.venv)..." -ForegroundColor Yellow
    if ($pythonCmd -eq "py") {
        & py -3 -m venv .venv
    }
    else {
        & python -m venv .venv
    }
}

# Activate virtual environment and install requirements
Write-Host "Installing and updating dependencies..." -ForegroundColor Yellow
& '.\.venv\Scripts\pip' install -r requirements.txt

# Start the application
Write-Host "Starting backend FastAPI server on http://127.0.0.1:8000..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Yellow
& '.\.venv\Scripts\python' -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
