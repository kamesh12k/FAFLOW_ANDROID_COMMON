# ==============================================================================
# FAFLOW Environment (.env) Intelligent Management Engine
# ==============================================================================

function Ensure-FaflowEnvironment {
    param(
        [string]$RootDir,
        [int]$PoolSize = 30,
        [int]$MaxOverflow = 20
    )
    
    $envPath = "$RootDir\backend\.env"
    $envExample = "$RootDir\backend\.env.example"
    $backupDir = "$RootDir\logs\backups"
    
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }
    
    $envMap = [ordered]@{}
    
    # 1. Backup existing .env if present
    if (Test-Path $envPath) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        Copy-Item -Path $envPath -Destination "$backupDir\.env.backup-$stamp" -Force -ErrorAction SilentlyContinue
        
        Get-Content $envPath | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $idx = $line.IndexOf("=")
                $key = $line.Substring(0, $idx).Trim()
                $val = $line.Substring($idx + 1).Trim()
                $envMap[$key] = $val
            }
        }
    }
    
    # 2. Defaults & Required Keys
    if (-not $envMap.Contains("DATABASE_URL")) {
        $envMap["DATABASE_URL"] = "postgresql://postgres@localhost:5432/credits_db"
    }
    
    # Cryptographically secure SECRET_KEY generation if missing or placeholder
    $placeholderKey = "your-super-secret-key-change-in-production-min-32-chars"
    if (-not $envMap.Contains("SECRET_KEY") -or $envMap["SECRET_KEY"] -eq $placeholderKey -or $envMap["SECRET_KEY"].Length -lt 32) {
        $bytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($bytes)
        $secretHex = ($bytes | ForEach-Object { "{0:x2}" -f $_ }) -join ""
        $envMap["SECRET_KEY"] = $secretHex
    }
    
    if (-not $envMap.Contains("ALGORITHM")) { $envMap["ALGORITHM"] = "HS256" }
    if (-not $envMap.Contains("ACCESS_TOKEN_EXPIRE_MINUTES")) { $envMap["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60" }
    if (-not $envMap.Contains("PERIODS_PER_DAY")) { $envMap["PERIODS_PER_DAY"] = "5" }
    if (-not $envMap.Contains("DAY_ORDER_MAX")) { $envMap["DAY_ORDER_MAX"] = "6" }
    if (-not $envMap.Contains("APP_NAME")) { $envMap["APP_NAME"] = "FAFLOW" }
    if (-not $envMap.Contains("PRIMARY_COLOR")) { $envMap["PRIMARY_COLOR"] = "#4f46e5" }
    if (-not $envMap.Contains("FRONTEND_ORIGIN")) { $envMap["FRONTEND_ORIGIN"] = '["http://localhost:5173"]' }
    if (-not $envMap.Contains("MAX_SECONDARY_ADMINS")) { $envMap["MAX_SECONDARY_ADMINS"] = "3" }
    
    # Dynamic DB connection pool settings
    if (-not $envMap.Contains("DB_POOL_SIZE")) { $envMap["DB_POOL_SIZE"] = "$PoolSize" }
    if (-not $envMap.Contains("DB_MAX_OVERFLOW")) { $envMap["DB_MAX_OVERFLOW"] = "$MaxOverflow" }
    if (-not $envMap.Contains("DB_POOL_TIMEOUT")) { $envMap["DB_POOL_TIMEOUT"] = "30" }
    if (-not $envMap.Contains("DB_POOL_RECYCLE")) { $envMap["DB_POOL_RECYCLE"] = "300" }
    
    # 3. Write sanitized, formatted .env
    $lines = @(
        "# ============================================================================",
        "# FAFLOW Production Environment Configuration",
        "# Auto-managed and verified by FAFLOW Server Orchestrator",
        "# ============================================================================"
    )
    foreach ($k in $envMap.Keys) {
        $lines += "$k=$($envMap[$k])"
    }
    
    Set-Content -Path $envPath -Value $lines -Encoding UTF8 -Force
    return $true
}
