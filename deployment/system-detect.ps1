# ==============================================================================
# FAFLOW Hardware, Environment, & Resource Detection Engine
# ==============================================================================

function Get-FaflowSystemProfile {
    param([string]$RootDir)
    
    # 1. OS & Architecture Detection
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $osName = if ($os) { $os.Caption } else { [System.Environment]::OSVersion.VersionString }
    $is64Bit = [System.Environment]::Is64BitOperatingSystem
    $arch = if ($is64Bit) { "x64" } else { "x86" }
    
    # 2. CPU Inspection
    $cpu = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    $cpuName = if ($cpu) { ($cpu.Name -replace '\s+', ' ').Trim() } else { "Generic CPU" }
    $physicalCores = if ($cpu -and $cpu.NumberOfCores) { $cpu.NumberOfCores } else { 1 }
    $logicalCores = [System.Environment]::ProcessorCount
    
    # 3. Memory (RAM) Inspection
    $totalRamBytes = if ($os) { [long]$os.TotalVisibleMemorySize * 1024 } else { 8589934592 }
    $freeRamBytes = if ($os) { [long]$os.FreePhysicalMemory * 1024 } else { 4294967296 }
    $totalRamGB = [Math]::Round($totalRamBytes / 1GB, 1)
    $freeRamGB = [Math]::Round($freeRamBytes / 1GB, 1)
    
    # 4. Drive & Disk Space Inspection
    $rootDrive = (Get-Item $RootDir).PSDrive
    $driveInfo = Get-PSDrive $rootDrive.Name -ErrorAction SilentlyContinue
    $freeDiskGB = if ($driveInfo) { [Math]::Round($driveInfo.Free / 1GB, 1) } else { 0 }
    
    # 5. Network & LAN IPv4 Detection (filters out loopback, link-local, and virtual adapters)
    $lanIps = @()
    try {
        $adapters = Get-NetIPAddress -AddressFamily IPv4 -Type Unicast -ErrorAction SilentlyContinue |
            Where-Object { 
                $_.IPAddress -notlike "127.*" -and 
                $_.IPAddress -notlike "169.254.*" -and 
                $_.InterfaceAlias -notmatch "(?i)(vEthernet|VirtualBox|VMware|Loopback|WSL)" 
            }
        foreach ($a in $adapters) {
            $lanIps += $a.IPAddress
        }
    } catch {}
    if ($lanIps.Count -eq 0) { $lanIps = @("127.0.0.1") }
    $primaryLanIp = $lanIps[0]
    
    # 6. Performance Profile Calculation
    # Philosophy: Prioritize stability over aggressive over-allocation
    $profile = "BALANCED"
    $calculatedWorkers = 2
    $calculatedPoolSize = 30
    $calculatedMaxOverflow = 20
    
    if ($totalRamGB -lt 6.0 -or $logicalCores -le 2) {
        $profile = "LOW"
        $calculatedWorkers = 1
        $calculatedPoolSize = 15
        $calculatedMaxOverflow = 10
    } elseif ($totalRamGB -ge 16.0 -and $logicalCores -gt 6) {
        $profile = "PERFORMANCE"
        # Safe upper bound of 4 workers to prevent PG connection exhaustion
        $calculatedWorkers = [Math]::Min(4, [Math]::Max(2, [int]($logicalCores / 2)))
        $calculatedPoolSize = 50
        $calculatedMaxOverflow = 30
    }
    
    return [PSCustomObject]@{
        OSName              = $osName
        Architecture        = $arch
        CPUName             = $cpuName
        PhysicalCores       = $physicalCores
        LogicalCores        = $logicalCores
        TotalRamGB          = $totalRamGB
        FreeRamGB           = $freeRamGB
        FreeDiskGB          = $freeDiskGB
        PrimaryLanIp        = $primaryLanIp
        AllLanIps           = $lanIps
        Profile             = $profile
        CalculatedWorkers   = $calculatedWorkers
        CalculatedPoolSize  = $calculatedPoolSize
        CalculatedMaxOverflow = $calculatedMaxOverflow
    }
}

function Get-FaflowToolLocations {
    param([string]$RootDir)
    
    $tools = [ordered]@{}
    
    # Git Detection
    $gitPath = ""
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $gitPath = (Get-Command git).Source
    } else {
        $commonGit = @(
            "$env:ProgramFiles\Git\bin\git.exe",
            "$env:ProgramFiles\Git\cmd\git.exe",
            "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
            "$env:LocalAppData\Programs\Git\bin\git.exe"
        )
        foreach ($p in $commonGit) { if (Test-Path $p) { $gitPath = $p; break } }
    }
    $tools["Git"] = $gitPath
    
    # Python Detection (Requires >= 3.11)
    $pythonPath = ""
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonPath = (Get-Command python).Source
    } else {
        $commonPython = @(
            "$env:LocalAppData\Programs\Python\Python312\python.exe",
            "$env:LocalAppData\Programs\Python\Python311\python.exe",
            "$env:ProgramFiles\Python312\python.exe",
            "$env:ProgramFiles\Python311\python.exe",
            "C:\Python312\python.exe",
            "C:\Python311\python.exe"
        )
        foreach ($p in $commonPython) { if (Test-Path $p) { $pythonPath = $p; break } }
    }
    $tools["Python"] = $pythonPath
    
    # Node.js Detection (Requires >= 18)
    $nodePath = ""
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodePath = (Get-Command node).Source
    } else {
        $commonNode = @(
            "$env:ProgramFiles\nodejs\node.exe",
            "${env:ProgramFiles(x86)}\nodejs\node.exe",
            "$env:AppData\npm\node.exe"
        )
        foreach ($p in $commonNode) { if (Test-Path $p) { $nodePath = $p; break } }
    }
    $tools["Node"] = $nodePath
    
    # NPM Detection
    $npmPath = ""
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $npmPath = (Get-Command npm).Source
    } else {
        $commonNpm = @(
            "$env:ProgramFiles\nodejs\npm.cmd",
            "${env:ProgramFiles(x86)}\nodejs\npm.cmd",
            "$env:AppData\npm\npm.cmd"
        )
        foreach ($p in $commonNpm) { if (Test-Path $p) { $npmPath = $p; break } }
    }
    $tools["NPM"] = $npmPath
    
    # PostgreSQL psql Detection
    $psqlPath = ""
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        $psqlPath = (Get-Command psql).Source
    } else {
        $pgBins = Get-ChildItem -Path @("$env:ProgramFiles\PostgreSQL", "${env:ProgramFiles(x86)}\PostgreSQL") -Recurse -Filter "psql.exe" -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch "pgAdmin" } |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($pgBins) {
            $psqlPath = $pgBins.FullName
        }
    }
    $tools["PostgreSQL"] = $psqlPath
    
    return $tools
}
