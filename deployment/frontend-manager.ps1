# ==============================================================================
# FAFLOW Frontend Production Build & Package Manager
# ==============================================================================

function Ensure-FrontendBuild {
    param(
        [string]$RootDir,
        [string]$NpmExec
    )
    
    $frontendDir = "$RootDir\frontend"
    $nodeModules = "$frontendDir\node_modules"
    $distIndex = "$frontendDir\dist\index.html"
    $packageLock = "$frontendDir\package-lock.json"
    
    # 1. Check/Install node_modules
    $needInstall = (-not (Test-Path $nodeModules))
    if ($needInstall) {
        Write-Host "  - Installing frontend dependencies..." -ForegroundColor Cyan
        if (Test-Path $packageLock) {
            $p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm ci --silent" -WorkingDirectory $frontendDir -NoNewWindow -PassThru -Wait
            if ($p.ExitCode -ne 0) {
                # Fallback to npm install
                $p2 = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install --silent" -WorkingDirectory $frontendDir -NoNewWindow -PassThru -Wait
            }
        } else {
            $p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install --silent" -WorkingDirectory $frontendDir -NoNewWindow -PassThru -Wait
        }
    }
    
    # 2. Build Production Bundle if dist is missing or older than src
    $needBuild = (-not (Test-Path $distIndex))
    if (-not $needBuild) {
        # Check timestamp of src vs dist
        $latestSrc = Get-ChildItem -Path "$frontendDir\src" -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        $distFile = Get-Item $distIndex
        if ($latestSrc -and $latestSrc.LastWriteTime -gt $distFile.LastWriteTime) {
            $needBuild = $true
        }
    }
    
    if ($needBuild) {
        Write-Host "  - Building production frontend bundle (Vite)..." -ForegroundColor Cyan
        $buildProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build" -WorkingDirectory $frontendDir -NoNewWindow -PassThru -Wait
        if ($buildProc.ExitCode -ne 0) {
            Write-Host "  - ERROR: Frontend production build failed." -ForegroundColor Red
            return $false
        }
    }
    
    return (Test-Path $distIndex)
}
