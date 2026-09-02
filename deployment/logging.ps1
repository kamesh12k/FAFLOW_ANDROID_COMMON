# ==============================================================================
# FAFLOW Logging & Log Rotation Engine
# ==============================================================================

function Initialize-FaflowLogging {
    param([string]$RootDir)
    
    $dirs = @(
        "$RootDir\logs\backend",
        "$RootDir\logs\frontend",
        "$RootDir\logs\system",
        "$RootDir\logs\deployment",
        "$RootDir\logs\health",
        "$RootDir\logs\errors",
        "$RootDir\logs\pids",
        "$RootDir\logs\backups"
    )
    
    foreach ($d in $dirs) {
        if (-not (Test-Path $d)) {
            New-Item -ItemType Directory -Path $d -Force | Out-Null
        }
    }
}

function Write-FaflowLog {
    param(
        [string]$RootDir,
        [string]$Category = "deployment",
        [string]$Level = "INFO",
        [string]$Message
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $dateStamp = Get-Date -Format "yyyy-MM-dd"
    $logFile = "$RootDir\logs\$Category\$Category-$dateStamp.log"
    
    # Mask any sensitive secrets or passwords before writing
    $sanitized = $Message -replace '(?i)(password|secret_key|token|auth_key|p256dh_key)\s*[:=]\s*[^,\s]+', '$1=[MASKED]'
    
    $logEntry = "[$timestamp] [$Level] $sanitized"
    
    try {
        Add-Content -Path $logFile -Value $logEntry -Encoding UTF8 -ErrorAction SilentlyContinue
    } catch {}
}

function Rotate-FaflowLogs {
    param(
        [string]$RootDir,
        [long]$MaxBytes = 10485760 # 10 MB
    )
    
    try {
        $logFiles = Get-ChildItem -Path "$RootDir\logs" -Recurse -Filter "*.log" -File -ErrorAction SilentlyContinue
        foreach ($file in $logFiles) {
            if ($file.Length -gt $MaxBytes) {
                $archiveStamp = Get-Date -Format "yyyyMMdd-HHmmss"
                $archivePath = "$($file.DirectoryName)\$($file.BaseName)-$archiveStamp.bak"
                Move-Item -Path $file.FullName -Destination $archivePath -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}
