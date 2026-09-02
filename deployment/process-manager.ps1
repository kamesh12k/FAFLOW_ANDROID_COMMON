# ==============================================================================
# FAFLOW Process Lifecycle & Auto-Healing Manager
# ==============================================================================

function Stop-FaflowServices {
    param(
        [string]$RootDir,
        [int]$BackendPort = 8000,
        [int]$FrontendPort = 5173
    )
    
    $pidsDir = "$RootDir\logs\pids"
    
    # 1. Stop by saved PID files & kill entire process trees
    foreach ($pidName in @("backend.pid", "frontend.pid")) {
        $pidFile = "$pidsDir\$pidName"
        if (Test-Path $pidFile) {
            $savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
            if ($savedPid -match '^\d+$') {
                $pInt = [int]$savedPid
                cmd.exe /c "taskkill /F /T /PID $pInt >nul 2>&1"
            }
            Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
        }
    }
    
    # 2. Terminate any FAFLOW watchdog PowerShell loops and server processes by exact signature
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { 
        ($_.Name -eq "powershell.exe" -and ($_.CommandLine -match "app\.main:app" -or $_.CommandLine -match "FAFLOW_" -or $_.CommandLine -match "uvicorn.*8000" -or $_.CommandLine -match "serve.*5173")) -or
        ($_.Name -match "python|node" -and ($_.CommandLine -match "app\.main:app" -or $_.CommandLine -match "serve.*dist"))
    } | ForEach-Object {
        cmd.exe /c "taskkill /F /T /PID $($_.ProcessId) >nul 2>&1"
    }
    
    # 3. Clean listening ports 8000 and 5173 with precision
    try {
        Get-NetTCPConnection -LocalPort $BackendPort, $FrontendPort -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object {
                $p = $_.OwningProcess
                if ($p -gt 4) {
                    cmd.exe /c "taskkill /F /T /PID $p >nul 2>&1"
                }
            }
    } catch {}
}

function Start-FaflowBackend {
    param(
        [string]$RootDir,
        [string]$VenvPython,
        [int]$Port = 8000,
        [int]$Workers = 2,
        [string]$LogLevel = "info"
    )
    
    $pidsDir = "$RootDir\logs\pids"
    if (-not (Test-Path $pidsDir)) { New-Item -ItemType Directory -Path $pidsDir -Force | Out-Null }
    
    $workerArg = if ($Workers -gt 1) { "--workers $Workers" } else { "" }
    $cmd = "`$host.ui.RawUI.WindowTitle = 'FAFLOW_BACKEND_PROD'; `$ErrorActionPreference = 'SilentlyContinue'; cd '$RootDir\backend'; while (`$true) { Write-Host '=== Starting FAFLOW Backend (Uvicorn) ===' -ForegroundColor Green; & '$VenvPython' -m uvicorn app.main:app --host 0.0.0.0 --port $Port $workerArg --log-level $($LogLevel.ToLower()); Write-Host '=== Backend stopped. Clearing port and restarting in 3s... ===' -ForegroundColor Yellow; try { Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id `$_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}; Start-Sleep -s 3 }"
    
    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -NoExit -Command `"$cmd`"" -PassThru
    
    if ($proc) {
        Set-Content -Path "$pidsDir\backend.pid" -Value $proc.Id -Force
        return $proc.Id
    }
    return $null
}

function Start-FaflowFrontend {
    param(
        [string]$RootDir,
        [int]$Port = 5173
    )
    
    $pidsDir = "$RootDir\logs\pids"
    if (-not (Test-Path $pidsDir)) { New-Item -ItemType Directory -Path $pidsDir -Force | Out-Null }
    
    $frontendDir = "$RootDir\frontend"
    $cmd = "`$host.ui.RawUI.WindowTitle = 'FAFLOW_FRONTEND_PROD'; `$ErrorActionPreference = 'SilentlyContinue'; cd '$frontendDir'; while (`$true) { Write-Host '=== Starting FAFLOW Frontend (Vite Production Preview) ===' -ForegroundColor Green; npm run preview; Write-Host '=== Frontend stopped. Restarting in 3s... ===' -ForegroundColor Yellow; try { Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id `$_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}; Start-Sleep -s 3 }"
    
    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -NoExit -Command `"$cmd`"" -PassThru
    
    if ($proc) {
        Set-Content -Path "$pidsDir\frontend.pid" -Value $proc.Id -Force
        return $proc.Id
    }
    return $null
}
