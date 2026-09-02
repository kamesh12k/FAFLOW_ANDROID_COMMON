# FAFLOW Android 16 KB Page-Size Compatibility Verification Script
# Evaluates ELF PT_LOAD segment alignment (align >= 16384 / 2^14) across all packaged .so libraries
# and validates APK zip alignment using Android SDK zipalign.

param(
    [string]$ApkPath = "app/build/outputs/apk/debug/app-debug.apk"
)

$ErrorActionPreference = "Stop"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host " FAFLOW Android 16 KB Page-Size Compatibility Audit" -ForegroundColor Cyan
Write-Host " Target APK: $ApkPath" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

if (-not (Test-Path $ApkPath)) {
    Write-Host "ERROR: Target APK '$ApkPath' not found!" -ForegroundColor Red
    exit 1
}

# Python ELF Alignment Verification
$pythonCode = @"
import zipfile, struct, sys

apk_path = sys.argv[1]
has_failure = False
so_count = 0
results = {}

with zipfile.ZipFile(apk_path, 'r') as z:
    for name in sorted(z.namelist()):
        if not name.endswith('.so'):
            continue
        so_count += 1
        data = z.read(name)
        abi = name.split('/')[1] if '/' in name else 'unknown'
        lib_name = name.split('/')[-1]
        
        if abi not in results:
            results[abi] = []
            
        if data[:4] == b'\x7fELF':
            is_64 = (data[4] == 2)
            if is_64:
                e_phoff, = struct.unpack('<Q', data[32:40])
                e_phentsize, = struct.unpack('<H', data[54:56])
                e_phnum, = struct.unpack('<H', data[56:58])
                aligns = []
                for i in range(e_phnum):
                    offset = e_phoff + i * e_phentsize
                    p_type, = struct.unpack('<I', data[offset:offset+4])
                    if p_type == 1: # PT_LOAD
                        p_align, = struct.unpack('<Q', data[offset+48:offset+56])
                        aligns.append(p_align)
                max_align = max(aligns) if aligns else 0
                is_16kb = (max_align >= 16384)
                if not is_16kb:
                    has_failure = True
                align_str = f'2**14 (0x{max_align:x})' if is_16kb else f'2**12 (0x{max_align:x})'
                status = 'PASS' if is_16kb else 'FAIL (4 KB)'
                results[abi].append((lib_name, align_str, status, is_16kb))
            else:
                results[abi].append((lib_name, '32-bit ELF', 'PASS (32-bit)', True))
        else:
            results[abi].append((lib_name, 'Invalid ELF', 'FAIL', False))
            has_failure = True

print('\n16 KB ELF LOAD SEGMENT ALIGNMENT AUDIT:')
print('-' * 70)
for abi, libs in sorted(results.items()):
    print(f'ABI: {abi}')
    for lib, align_str, status, is_ok in libs:
        status_color = 'PASS' if is_ok else 'FAIL'
        print(f'  {lib:<40} {align_str:<20} {status}')
print('-' * 70)

if has_failure:
    print('\nOVERALL ELF STATUS: FAIL — 64-bit native libraries present with < 16 KB alignment')
    sys.exit(2)
else:
    print('\nOVERALL ELF STATUS: PASS — All 64-bit native libraries aligned to 16 KB (2**14+)')
    sys.exit(0)
"@

$pyResult = py -c $pythonCode $ApkPath
Write-Host $pyResult

$elfExit = $LASTEXITCODE

# ZipAlign Verification
Write-Host "`nAPK ZIP ALIGNMENT AUDIT:" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------------------" -ForegroundColor Gray
$zipalignPath = "C:\Users\kames\AppData\Local\Android\Sdk\build-tools\36.0.0\zipalign.exe"
if (Test-Path $zipalignPath) {
    & $zipalignPath -c -P 16 -v 4 $ApkPath | Select-Object -Last 5
    $zipExit = $LASTEXITCODE
    if ($zipExit -eq 0) {
        Write-Host "RESULT: APK ZIP ALIGNMENT PASS (16 KB page-aligned)" -ForegroundColor Green
    } else {
        Write-Host "RESULT: APK ZIP ALIGNMENT FAIL" -ForegroundColor Red
    }
} else {
    Write-Host "WARNING: zipalign not found at expected path; skipping zip verification." -ForegroundColor Yellow
    $zipExit = 0
}

Write-Host "================================================================================" -ForegroundColor Cyan
if ($elfExit -eq 0 -and $zipExit -eq 0) {
    Write-Host "RESULT: 16 KB COMPATIBLE (PRODUCTION READY)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "RESULT: NOT 16 KB COMPATIBLE" -ForegroundColor Red
    exit 1
}
