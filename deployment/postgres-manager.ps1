# ==============================================================================
# FAFLOW PostgreSQL Service & Database Management Engine
# ==============================================================================

function Ensure-PostgresService {
    $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($service) {
        if ($service.Status -ne "Running") {
            try {
                Start-Service -Name $service.Name -ErrorAction Stop
                Start-Sleep -Seconds 2
            } catch {
                # If non-admin, try net start fallback
                try { cmd /c "net start $($service.Name) 2>nul" } catch {}
            }
        }
    }
    
    # Check TCP port 5432
    $tcpOk = $false
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect("127.0.0.1", 5432, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne(2000, $false)
        if ($wait -and $tcp.Connected) {
            $tcpOk = $true
            $tcp.EndConnect($iar)
        }
        $tcp.Close()
    } catch {
        $tcpOk = $false
    }
    return $tcpOk
}

function Test-PostgresDatabaseConnection {
    param(
        [string]$RootDir,
        [string]$PythonExec
    )
    
    if (-not (Test-Path $PythonExec)) { return $false }
    
    $testScript = @"
import os, sys
sys.path.insert(0, os.path.abspath(r'$RootDir\backend'))
try:
    from app.database import engine
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    sys.exit(0)
except Exception as e:
    sys.exit(1)
"@
    
    $tmpFile = "$RootDir\logs\db_test_tmp.py"
    try {
        Set-Content -Path $tmpFile -Value $testScript -Encoding UTF8 -Force
        $proc = Start-Process -FilePath $PythonExec -ArgumentList "`"$tmpFile`"" -WorkingDirectory "$RootDir\backend" -NoNewWindow -PassThru -Wait
        $exitCode = $proc.ExitCode
        Remove-Item -Path $tmpFile -Force -ErrorAction SilentlyContinue
        return ($exitCode -eq 0)
    } catch {
        Remove-Item -Path $tmpFile -Force -ErrorAction SilentlyContinue
        return $false
    }
}

function Initialize-PostgresDatabase {
    param(
        [string]$RootDir,
        [string]$PsqlExec
    )
    
    if (-not $PsqlExec -or -not (Test-Path $PsqlExec)) {
        return $false
    }
    
    # Prompt password securely via masked input
    Write-Host "PostgreSQL authentication required to create/initialize database." -ForegroundColor Yellow
    $securePass = Read-Host -Prompt "Enter PostgreSQL 'postgres' user password" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
    $plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    
    $env:PGPASSWORD = $plainPass
    
    # Create database if not exists
    try {
        & $PsqlExec -h localhost -U postgres -c "CREATE DATABASE credits_db;" 2>$null
    } catch {}
    
    # Apply schema.sql
    $schemaPath = "$RootDir\database\schema.sql"
    if (Test-Path $schemaPath) {
        & $PsqlExec -h localhost -U postgres -d credits_db -f "$schemaPath" 2>$null
    }
    
    $env:PGPASSWORD = $null
    return $true
}
