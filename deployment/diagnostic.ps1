# ==============================================================================
# FAFLOW Full System Diagnostic & Health Audit Engine (Read-Only)
# ==============================================================================

param([string]$RootDir)

if (-not $RootDir) {
    $RootDir = (Get-Item $PSScriptRoot).Parent.FullName
} else {
    $RootDir = $RootDir.Trim("'").Trim('"')
}

. "$RootDir\deployment\logging.ps1"
. "$RootDir\deployment\system-detect.ps1"
. "$RootDir\deployment\postgres-manager.ps1"
. "$RootDir\deployment\python-manager.ps1"
. "$RootDir\deployment\health-check.ps1"

Initialize-FaflowLogging -RootDir $RootDir

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$diagReportFile = "$RootDir\logs\diagnostic-$timestamp.txt"

$report = @(
    "================================================================================",
    "               FAFLOW SYSTEM DIAGNOSTIC & READ-ONLY AUDIT REPORT               ",
    "================================================================================",
    "Generated At: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "Root Directory: $RootDir",
    ""
)

# 1. Hardware & System
$profile = Get-FaflowSystemProfile -RootDir $RootDir
$report += @(
    "--- 1. SYSTEM HARDWARE & OS ---",
    "Operating System:    $($profile.OSName) ($($profile.Architecture))",
    "CPU Processor:       $($profile.CPUName)",
    "Cores (Phys/Log):    $($profile.PhysicalCores) Physical / $($profile.LogicalCores) Logical",
    "Memory (RAM):        $($profile.TotalRamGB) GB Total / $($profile.FreeRamGB) GB Available",
    "Disk Free Space:     $($profile.FreeDiskGB) GB Free",
    "Performance Profile: $($profile.Profile) (Calculated Workers: $($profile.CalculatedWorkers), DB Pool: $($profile.CalculatedPoolSize))",
    ""
)

# 2. Prerequisites & Tool Paths
$tools = Get-FaflowToolLocations -RootDir $RootDir
$report += "--- 2. TOOLCHAIN & PREREQUISITES ---"
foreach ($k in $tools.Keys) {
    $status = if ($tools[$k]) { "FOUND -> $($tools[$k])" } else { "NOT FOUND [Missing]" }
    $report += "  - $($k): $status"
}
$report += ""

# 3. Environment & Configuration
$envPath = "$RootDir\backend\.env"
$report += @(
    "--- 3. CONFIGURATION (.env) ---",
    "Environment File:    $(if (Test-Path $envPath) { 'PRESENT' } else { 'MISSING' })",
    ""
)

# 4. PostgreSQL & Database Status
$pgService = Ensure-PostgresService
$report += @(
    "--- 4. POSTGRESQL & DATABASE ---",
    "PostgreSQL Service:  $(if ($pgService) { 'RUNNING (Port 5432 Open)' } else { 'STOPPED / UNREACHABLE' })"
)
$venvPython = "$RootDir\backend\venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    $dbConn = Test-PostgresDatabaseConnection -RootDir $RootDir -PythonExec $venvPython
    $report += "Database Connection: $(if ($dbConn) { 'CONNECTED (credits_db Ready)' } else { 'FAILED' })"
} else {
    $report += "Database Connection: SKIPPED (venv python not present)"
}
$report += ""

# 5. Python Environment & Imports
$report += "--- 5. PYTHON & BACKEND INTEGRITY ---"
if (Test-Path $venvPython) {
    $importsOk = Test-BackendApplicationImports -RootDir $RootDir -VenvPython $venvPython
    $report += "Python VirtualEnv:   HEALTHY ($venvPython)"
    $report += "Application Imports: $(if ($importsOk) { 'PASSED (app.main + routes healthy)' } else { 'FAILED' })"
} else {
    $report += "Python VirtualEnv:   MISSING / NOT CONFIGURED"
    $report += "Application Imports: UNVERIFIED"
}
$report += ""

# 6. Frontend Production Build
$distIndex = "$RootDir\frontend\dist\index.html"
$report += @(
    "--- 6. FRONTEND PRODUCTION ASSETS ---",
    "Production Build:    $(if (Test-Path $distIndex) { 'BUILT (dist\index.html verified)' } else { 'NOT BUILT / MISSING' })",
    ""
)

# 7. Network & Active Ports
$report += @(
    "--- 7. NETWORK & INTERFACES ---",
    "Primary LAN IP:      http://$($profile.PrimaryLanIp):5173",
    "All Local IPv4s:     $(($profile.AllLanIps) -join ', ')",
    ""
)

$report += @(
    "================================================================================",
    "                          END OF DIAGNOSTIC REPORT                              ",
    "================================================================================"
)

Set-Content -Path $diagReportFile -Value $report -Encoding UTF8 -Force

Write-Host ""
Write-Host "Diagnostic audit complete. Report saved to:" -ForegroundColor Green
Write-Host "  $diagReportFile" -ForegroundColor Cyan
Write-Host ""
Get-Content -Path $diagReportFile
