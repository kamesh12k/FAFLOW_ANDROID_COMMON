# ==============================================================================
# FAFLOW Health Verification & Smoke Testing Engine
# ==============================================================================

function Test-FaflowServicesHealth {
    param(
        [int]$BackendPort = 8000,
        [int]$FrontendPort = 5173,
        [int]$MaxWaitSeconds = 15
    )
    
    $backendUrl = "http://127.0.0.1:$BackendPort/health"
    $docsUrl = "http://127.0.0.1:$BackendPort/docs"
    $frontendUrl = "http://127.0.0.1:$FrontendPort"
    
    $backendHealthy = $false
    $frontendHealthy = $false
    
    $startTime = [System.Diagnostics.Stopwatch]::StartNew()
    
    while ($startTime.Elapsed.TotalSeconds -lt $MaxWaitSeconds) {
        # Check Backend Health
        if (-not $backendHealthy) {
            try {
                $bRes = Invoke-WebRequest -Uri $backendUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
                if ($bRes.StatusCode -eq 200) {
                    $backendHealthy = $true
                }
            } catch {}
        }
        
        # Check Frontend Health
        if (-not $frontendHealthy) {
            try {
                $fRes = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
                if ($fRes.StatusCode -eq 200 -and $fRes.Content.Length -gt 50) {
                    $frontendHealthy = $true
                }
            } catch {}
        }
        
        if ($backendHealthy -and $frontendHealthy) { break }
        Start-Sleep -Milliseconds 800
    }
    
    return [PSCustomObject]@{
        BackendHealthy  = $backendHealthy
        FrontendHealthy = $frontendHealthy
        ElapsedTimeSec  = [Math]::Round($startTime.Elapsed.TotalSeconds, 1)
        OverallHealthy  = ($backendHealthy -and $frontendHealthy)
    }
}
