# ==============================================================================
# FAFLOW Master Production Deployment & Orchestration Engine
# ==============================================================================

param(
    [string]$RootDir,
    [switch]$NoBrowser,
    [switch]$NoPause,
    [switch]$LanMode,
    [switch]$RepairOnly
)

$ErrorActionPreference = "Continue"

if (-not $RootDir) {
    $RootDir = (Get-Item $PSScriptRoot).Parent.FullName
} else {
    $RootDir = $RootDir.Trim("'").Trim('"')
}

# Import sub-modules
. "$RootDir\deployment\logging.ps1"
. "$RootDir\deployment\system-detect.ps1"
. "$RootDir\deployment\env-manager.ps1"
. "$RootDir\deployment\postgres-manager.ps1"
. "$RootDir\deployment\python-manager.ps1"
. "$RootDir\deployment\frontend-manager.ps1"
. "$RootDir\deployment\process-manager.ps1"
. "$RootDir\deployment\health-check.ps1"

# 1. Initialize Log Directories
Initialize-FaflowLogging -RootDir $RootDir
Rotate-FaflowLogs -RootDir $RootDir

Write-FaflowLog -RootDir $RootDir -Category "deployment" -Level "INFO" -Message "Initiating FAFLOW production deployment sequence..."

Write-Host "================================================================================" -ForegroundColor Blue
Write-Host "             FAFLOW ENTERPRISE PRODUCTION SERVER ORCHESTRATOR                   " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Blue
Write-Host ""

# 2. System & Hardware Inspection
Write-Host "[1/7] Inspecting system architecture and hardware resources..." -ForegroundColor Cyan
$profile = Get-FaflowSystemProfile -RootDir $RootDir

Write-Host "  - OS:           $($profile.OSName) ($($profile.Architecture))" -ForegroundColor Gray
Write-Host "  - CPU:          $($profile.CPUName) [$($profile.PhysicalCores) Cores / $($profile.LogicalCores) Threads]" -ForegroundColor Gray
Write-Host "  - Memory:       $($profile.TotalRamGB) GB RAM ($($profile.FreeRamGB) GB Available)" -ForegroundColor Gray
Write-Host "  - Disk:         $($profile.FreeDiskGB) GB Free" -ForegroundColor Gray
Write-Host "  - Profile:      $($profile.Profile) -> Concurrency: $($profile.CalculatedWorkers) Workers, DB Pool: $($profile.CalculatedPoolSize) [Overflow: $($profile.CalculatedMaxOverflow)]" -ForegroundColor Green
Write-Host ""

# Apply environment variable overrides from deployment.config.bat if defined
$backendPort = if ($env:FAFLOW_BACKEND_PORT) { [int]$env:FAFLOW_BACKEND_PORT } else { 8000 }
$frontendPort = if ($env:FAFLOW_FRONTEND_PORT) { [int]$env:FAFLOW_FRONTEND_PORT } else { 5173 }
$workers = if ($env:FAFLOW_WORKERS) { [int]$env:FAFLOW_WORKERS } else { $profile.CalculatedWorkers }
$dbPoolSize = if ($env:FAFLOW_DB_POOL_SIZE) { [int]$env:FAFLOW_DB_POOL_SIZE } else { $profile.CalculatedPoolSize }
$dbMaxOverflow = if ($env:FAFLOW_DB_MAX_OVERFLOW) { [int]$env:FAFLOW_DB_MAX_OVERFLOW } else { $profile.CalculatedMaxOverflow }
$logLevel = if ($env:FAFLOW_LOG_LEVEL) { $env:FAFLOW_LOG_LEVEL } else { "INFO" }

# 3. Toolchain & Prerequisites Auto-Discovery
Write-Host "[2/7] Discovering and validating toolchain binaries..." -ForegroundColor Cyan
$tools = Get-FaflowToolLocations -RootDir $RootDir

# Auto-add discovered tool directories to PATH for current session
foreach ($toolName in $tools.Keys) {
    $execPath = $tools[$toolName]
    if ($execPath -and (Test-Path $execPath)) {
        $dir = (Get-Item $execPath).DirectoryName
        if ($env:PATH -notlike "*$dir*") {
            $env:PATH = "$dir;$env:PATH"
        }
        Write-Host "  - $($toolName):       Found [$execPath]" -ForegroundColor Green
    } else {
        if ($toolName -in @("Python", "Node", "NPM")) {
            Write-Host "  - $($toolName):       NOT FOUND [CRITICAL REQUIRED PREREQUISITE]" -ForegroundColor Red
            Write-FaflowLog -RootDir $RootDir -Category "errors" -Level "ERROR" -Message "Missing critical prerequisite: $toolName"
            Write-Host ""
            Write-Host "DEPLOYMENT HALTED: Please install $toolName and re-run StartProd.bat." -ForegroundColor Red
            exit 1
        } else {
            Write-Host "  - $($toolName):       Not in standard path (Optional)" -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# 4. Environment & Security Configuration (.env)
Write-Host "[3/7] Managing environment configuration and secrets..." -ForegroundColor Cyan
Ensure-FaflowEnvironment -RootDir $RootDir -PoolSize $dbPoolSize -MaxOverflow $dbMaxOverflow | Out-Null
Write-Host "  - Configuration: Verified [backend\.env]" -ForegroundColor Green
Write-Host ""

# 5. PostgreSQL & Database Initialization
Write-Host "[4/7] Verifying PostgreSQL service and database connectivity..." -ForegroundColor Cyan
$pgRunning = Ensure-PostgresService
if (-not $pgRunning) {
    Write-Host "  - WARNING: PostgreSQL on port 5432 is not responding." -ForegroundColor Yellow
    Write-Host "  - Attempting database connection check..." -ForegroundColor Yellow
} else {
    Write-Host "  - PostgreSQL:    Running [Port 5432 Open]" -ForegroundColor Green
}

# 6. Python Environment & Dependency Verification
Write-Host "[5/7] Preparing Python backend virtual environment..." -ForegroundColor Cyan
$venvPython = Ensure-PythonVirtualEnv -RootDir $RootDir -SystemPython $tools["Python"]
if (-not $venvPython) {
    Write-Host "  - ERROR: Failed to configure Python virtual environment." -ForegroundColor Red
    exit 1
}
Ensure-PythonPackages -RootDir $RootDir -VenvPython $venvPython | Out-Null

$importsOk = Test-BackendApplicationImports -RootDir $RootDir -VenvPython $venvPython
if (-not $importsOk) {
    Write-Host "  - ERROR: Backend import validation failed." -ForegroundColor Red
    Write-FaflowLog -RootDir $RootDir -Category "errors" -Level "ERROR" -Message "Backend import validation failed."
    exit 1
}
Write-Host "  - Backend Venv:  Verified and application imports healthy." -ForegroundColor Green
Write-Host ""

# Check Database Connection via backend
$dbReady = Test-PostgresDatabaseConnection -RootDir $RootDir -PythonExec $venvPython
if (-not $dbReady) {
    Write-Host "  - Target database 'credits_db' needs initialization." -ForegroundColor Yellow
    $initSuccess = Initialize-PostgresDatabase -RootDir $RootDir -PsqlExec $tools["PostgreSQL"]
    $dbReady = Test-PostgresDatabaseConnection -RootDir $RootDir -PythonExec $venvPython
    if (-not $dbReady) {
        Write-Host "  - WARNING: Database connection could not be established. Verify PostgreSQL credentials." -ForegroundColor Yellow
    }
} else {
    Write-Host "  - Database:      Connected [credits_db ready]" -ForegroundColor Green
}
Write-Host ""

# 7. Frontend Production Build Verification
Write-Host "[6/7] Verifying frontend production build assets..." -ForegroundColor Cyan
$buildOk = Ensure-FrontendBuild -RootDir $RootDir -NpmExec $tools["NPM"]
if (-not $buildOk) {
    Write-Host "  - ERROR: Frontend production build verification failed." -ForegroundColor Red
    exit 1
}
Write-Host "  - Frontend:      Production bundle verified [dist\index.html ready]." -ForegroundColor Green
Write-Host ""

if ($RepairOnly) {
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "                     FAFLOW REPAIR & AUDIT COMPLETED                            " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    exit 0
}

# 8. Start Production Services
Write-Host "[7/7] Launching FAFLOW Production Server Processes..." -ForegroundColor Cyan

# Clean existing FAFLOW processes and ports cleanly
Stop-FaflowServices -RootDir $RootDir -BackendPort $backendPort -FrontendPort $frontendPort
Start-Sleep -Seconds 1

# Start Backend
$backendPid = Start-FaflowBackend -RootDir $RootDir -VenvPython $venvPython -Port $backendPort -Workers $workers -LogLevel $logLevel
Write-Host "  - Backend process started [PID: $backendPid] on port $backendPort ($workers workers)" -ForegroundColor Green

# Start Frontend
$frontendPid = Start-FaflowFrontend -RootDir $RootDir -Port $frontendPort
Write-Host "  - Frontend preview server started [PID: $frontendPid] on port $frontendPort" -ForegroundColor Green

# 9. Health Check & Validation
Write-Host ""
Write-Host "Running automated health checks..." -ForegroundColor Cyan
$health = Test-FaflowServicesHealth -BackendPort $backendPort -FrontendPort $frontendPort -MaxWaitSeconds 15

if (-not $health.OverallHealthy) {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host "                         DEPLOYMENT HEALTH CHECK FAILED                         " -ForegroundColor Red
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host "  - Backend Status:  $(if ($health.BackendHealthy) { 'HEALTHY' } else { 'UNRESPONSIVE (Port ' + $backendPort + ')' })" -ForegroundColor Red
    Write-Host "  - Frontend Status: $(if ($health.FrontendHealthy) { 'HEALTHY' } else { 'UNRESPONSIVE (Port ' + $frontendPort + ')' })" -ForegroundColor Red
    Write-Host "  - Logs captured in: logs\backend\ and logs\frontend\" -ForegroundColor Yellow
    exit 1
}

# 10. Success Summary Report
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "               FAFLOW PRODUCTION SERVER IS HEALTHY & ACTIVE                     " -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "  Status:        HEALTHY (Verified in $($health.ElapsedTimeSec)s)" -ForegroundColor Green
Write-Host ""
Write-Host "  Application URLs:" -ForegroundColor Cyan
Write-Host "    - Local Web App:     http://localhost:$frontendPort" -ForegroundColor White
Write-Host "    - Local Backend API: http://localhost:$backendPort" -ForegroundColor White
Write-Host "    - API Documentation: http://localhost:$backendPort/docs" -ForegroundColor White
if ($profile.PrimaryLanIp -ne "127.0.0.1") {
    Write-Host "    - Network (LAN) App: http://$($profile.PrimaryLanIp):$frontendPort" -ForegroundColor Yellow
    Write-Host "    - Network (LAN) API: http://$($profile.PrimaryLanIp):$backendPort" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  System Architecture:" -ForegroundColor Cyan
Write-Host "    - Performance Mode:  $($profile.Profile) Profile ($workers Backend Workers, Pool: $dbPoolSize)" -ForegroundColor Gray
Write-Host "    - Hardware:          $($profile.CPUName) | $($profile.TotalRamGB) GB RAM" -ForegroundColor Gray
Write-Host "    - Database:          PostgreSQL (credits_db)" -ForegroundColor Gray
Write-Host "    - Active PIDs:       Backend [$backendPid] | Frontend [$frontendPid]" -ForegroundColor Gray
Write-Host ""
Write-Host "  Management Commands:" -ForegroundColor Cyan
Write-Host "    - Health Audit:      StartProd.bat --health" -ForegroundColor Gray
Write-Host "    - Full Diagnostic:   StartProd.bat --diagnostic" -ForegroundColor Gray
Write-Host "    - Graceful Stop:     StopProd.bat" -ForegroundColor Gray
Write-Host "    - Full Restart:      RestartProd.bat" -ForegroundColor Gray
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""

Write-FaflowLog -RootDir $RootDir -Category "deployment" -Level "INFO" -Message "FAFLOW Production server started successfully. Backend PID: $backendPid, Frontend PID: $frontendPid."

# Open Browser if enabled
$autoBrowser = if ($env:FAFLOW_AUTO_BROWSER -eq "false" -or $NoBrowser) { $false } else { $true }
if ($autoBrowser) {
    Write-Host "Opening web application in default browser..." -ForegroundColor Green
    Start-Process "http://localhost:$frontendPort"
}
