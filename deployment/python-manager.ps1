# ==============================================================================
# FAFLOW Python Virtual Environment & Dependency Manager
# ==============================================================================

function Ensure-PythonVirtualEnv {
    param(
        [string]$RootDir,
        [string]$SystemPython
    )
    
    $venvDir = "$RootDir\backend\venv"
    $venvPython = "$venvDir\Scripts\python.exe"
    $venvPip = "$venvDir\Scripts\pip.exe"
    
    $isCorrupted = $false
    if (Test-Path $venvDir) {
        if (-not (Test-Path $venvPython) -or -not (Test-Path $venvPip)) {
            $isCorrupted = $true
        } else {
            # Test if venv python executes
            try {
                $p = Start-Process -FilePath $venvPython -ArgumentList "-c `"import sys; sys.exit(0)`"" -NoNewWindow -PassThru -Wait
                if ($p.ExitCode -ne 0) { $isCorrupted = $true }
            } catch {
                $isCorrupted = $true
            }
        }
    }
    
    if ($isCorrupted) {
        Write-Host "  - Corrupted Python virtual environment detected. Rebuilding..." -ForegroundColor Yellow
        Remove-Item -Path $venvDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    if (-not (Test-Path $venvDir)) {
        Write-Host "  - Creating Python virtual environment in backend\venv..." -ForegroundColor Cyan
        & $SystemPython -m venv "$venvDir"
        if (-not (Test-Path $venvPython)) {
            Write-Host "  - ERROR: Failed to create Python virtual environment." -ForegroundColor Red
            return $null
        }
        
        # Upgrade pip safely
        & $venvPython -m pip install --upgrade pip --quiet 2>$null
    }
    
    return $venvPython
}

function Ensure-PythonPackages {
    param(
        [string]$RootDir,
        [string]$VenvPython
    )
    
    $reqFile = "$RootDir\backend\requirements.txt"
    if (-not (Test-Path $reqFile)) { return $false }
    
    # Check if core packages already importable
    $checkScript = @"
import sys
try:
    import fastapi
    import uvicorn
    import sqlalchemy
    import psycopg2
    import pydantic
    import jose
    import passlib
    sys.exit(0)
except Exception:
    sys.exit(1)
"@
    
    $needsInstall = $false
    try {
        $p = Start-Process -FilePath $VenvPython -ArgumentList "-c `"$checkScript`"" -NoNewWindow -PassThru -Wait
        if ($p.ExitCode -ne 0) { $needsInstall = $true }
    } catch {
        $needsInstall = $true
    }
    
    if ($needsInstall) {
        Write-Host "  - Installing/Updating Python dependencies from requirements.txt..." -ForegroundColor Cyan
        $installProc = Start-Process -FilePath $VenvPython -ArgumentList "-m pip install -r `"$reqFile`" --quiet" -NoNewWindow -PassThru -Wait
        if ($installProc.ExitCode -ne 0) {
            Write-Host "  - Retrying dependency installation..." -ForegroundColor Yellow
            $retryProc = Start-Process -FilePath $VenvPython -ArgumentList "-m pip install -r `"$reqFile`"" -NoNewWindow -PassThru -Wait
            if ($retryProc.ExitCode -ne 0) {
                Write-Host "  - ERROR: Failed to install Python dependencies." -ForegroundColor Red
                return $false
            }
        }
    }
    
    return $true
}

function Test-BackendApplicationImports {
    param(
        [string]$RootDir,
        [string]$VenvPython
    )
    
    $importTestScript = @"
import os, sys
sys.path.insert(0, os.path.abspath(r'$RootDir\backend'))
try:
    import app.main
    import app.database
    import app.config
    import app.routes.auth
    import app.routes.leaves
    import app.routes.credits
    import app.routes.substitutions
    import app.routes.timetable
    sys.exit(0)
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
"@
    
    $tmpTest = "$RootDir\logs\import_test_tmp.py"
    try {
        Set-Content -Path $tmpTest -Value $importTestScript -Encoding UTF8 -Force
        $p = Start-Process -FilePath $VenvPython -ArgumentList "`"$tmpTest`"" -WorkingDirectory "$RootDir\backend" -NoNewWindow -PassThru -Wait
        $code = $p.ExitCode
        Remove-Item -Path $tmpTest -Force -ErrorAction SilentlyContinue
        return ($code -eq 0)
    } catch {
        Remove-Item -Path $tmpTest -Force -ErrorAction SilentlyContinue
        return $false
    }
}
