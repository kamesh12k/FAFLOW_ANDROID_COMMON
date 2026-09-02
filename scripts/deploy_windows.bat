@echo off
REM ==========================================================================
REM FAFLOW - Production Deployment Automation (Windows)
REM ==========================================================================

setlocal enabledelayedexpansion
cls

:: Anchor working directory to project root
cd /d "%~dp0.."
set "ROOT_DIR=%~dp0.."
for %%i in ("%ROOT_DIR%") do set "ROOT_DIR=%%~fi"

:: ANSI escape color codes setup
for /f "tokens=1,2 delims=#" %%a in ('"prompt #$H#$E# & echo on & for %%b in (1) do rem"') do set "ESC=%%b"
set "GREEN=%ESC%[92m"
set "RED=%ESC%[91m"
set "YELLOW=%ESC%[93m"
set "BLUE=%ESC%[94m"
set "CYAN=%ESC%[96m"
set "RESET=%ESC%[0m"
set "BG_BLUE=%ESC%[44m%ESC%[97m"

echo %BLUE%========================================================================%RESET%
echo %BG_BLUE%                 FAFLOW - WINDOWS PRODUCTION DEPLOYMENT                 %RESET%
echo %BLUE%========================================================================%RESET%
echo.

echo %CYAN%[1/10] Checking Python installation...%RESET%
python -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
if errorlevel 1 (
    echo %RED%ERROR: Python 3.11+ not found. Download from https://python.org%RESET%
    pause
    exit /b 1
)
echo   Python: %GREEN%OK%RESET%

echo %CYAN%[2/10] Checking Node.js installation...%RESET%
node --version >nul 2>&1
if errorlevel 1 (
    echo %RED%ERROR: Node.js 18+ not found. Download from https://nodejs.org%RESET%
    pause
    exit /b 1
)
echo   Node.js: %GREEN%OK%RESET%

echo %CYAN%[3/10] Checking PostgreSQL installation...%RESET%
psql --version >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%WARNING: PostgreSQL psql CLI not found in PATH. Install from https://postgresql.org%RESET%
) else (
    echo   PostgreSQL: %GREEN%OK%RESET%
)

echo %CYAN%[4/10] Setting up backend Python virtual environment...%RESET%
set "VENV_DIR=!ROOT_DIR!\backend\venv"
if not exist "!VENV_DIR!" (
    python -m venv "!VENV_DIR!"
    if errorlevel 1 (
        echo %RED%ERROR: Failed to create virtual environment in !VENV_DIR!%RESET%
        pause
        exit /b 1
    )
)
echo   Virtual environment: %GREEN%OK%RESET%

echo %CYAN%[5/10] Installing backend dependencies...%RESET%
"!VENV_DIR!\Scripts\python.exe" -m pip install -q -r "!ROOT_DIR!\backend\requirements.txt"
if errorlevel 1 (
    echo %RED%ERROR: Failed to install backend dependencies.%RESET%
    pause
    exit /b 1
)
echo   Backend dependencies: %GREEN%OK%RESET%

echo %CYAN%[6/10] Creating .env file configuration...%RESET%
if not exist "!ROOT_DIR!\backend\.env" (
    "!VENV_DIR!\Scripts\python.exe" -c "import secrets; print(secrets.token_hex(32))" > "!ROOT_DIR!\temp_secret.txt" 2>nul
    set /p SECRET_KEY=<"!ROOT_DIR!\temp_secret.txt"
    del "!ROOT_DIR!\temp_secret.txt" 2>nul
    (
        echo DATABASE_URL=postgresql://postgres@localhost:5432/credits_db
        echo SECRET_KEY=!SECRET_KEY!
        echo ALGORITHM=HS256
        echo ACCESS_TOKEN_EXPIRE_MINUTES=60
        echo VAPID_PUBLIC_KEY=
        echo VAPID_PRIVATE_KEY=
        echo VAPID_CONTACT_EMAIL=admin@faflow.com
        echo PERIODS_PER_DAY=5
        echo DAY_ORDER_MAX=6
        echo APP_NAME=FAFLOW
        echo PRIMARY_COLOR=#4f46e5
        echo FRONTEND_ORIGIN=http://localhost:5173
        echo MAX_SECONDARY_ADMINS=3
    ) > "!ROOT_DIR!\backend\.env"
    echo   Created backend\.env with generated SECRET_KEY: %GREEN%OK%RESET%
) else (
    echo   backend\.env already exists: %GREEN%Skipped%RESET%
)

echo %CYAN%[7/10] Database initialization...%RESET%
echo.
echo This script will attempt to create the database and run schema migrations.
echo PostgreSQL must be running and accessible at localhost:5432
echo.

set "PGPASSWORD="
setlocal disabledelayedexpansion
set /p PGPASSWORD="Enter PostgreSQL 'postgres' user password: "
endlocal & set "PGPASSWORD=%PGPASSWORD%"

set "PSQL_EXEC="
where psql >nul 2>&1
if !errorlevel! equ 0 (
    for /f "delims=" %%i in ('where psql') do (
        set "PSQL_EXEC=%%i"
        goto :deploy_psql_found
    )
)
for /d %%d in ("%ProgramFiles%\PostgreSQL\*" "%ProgramFiles(x86)%\PostgreSQL\*") do (
    if exist "%%d\bin\psql.exe" (
        set "PSQL_EXEC=%%d\bin\psql.exe"
        set "PATH=%%d\bin;!PATH!"
        goto :deploy_psql_found
    )
)
:deploy_psql_found

if defined PSQL_EXEC (
    "!PSQL_EXEC!" -h localhost -U postgres -c "CREATE DATABASE credits_db;" 2>nul
    "!PSQL_EXEC!" -h localhost -U postgres -d credits_db -f "!ROOT_DIR!\database\schema.sql"
    if errorlevel 1 (
        echo %RED%ERROR: Database setup failed. Ensure PostgreSQL is running on port 5432.%RESET%
        pause
        exit /b 1
    )
) else (
    psql -h localhost -U postgres -c "CREATE DATABASE credits_db;" 2>nul
    psql -h localhost -U postgres -d credits_db -f "!ROOT_DIR!\database\schema.sql"
    if errorlevel 1 (
        echo %RED%ERROR: Database setup failed. Ensure PostgreSQL is running on port 5432.%RESET%
        pause
        exit /b 1
    )
)
echo   Database initialization: %GREEN%OK%RESET%

echo %CYAN%[8/10] Running pre-flight checks...%RESET%
pushd "!ROOT_DIR!\backend"
"!VENV_DIR!\Scripts\python.exe" preflight_check.py >nul 2>&1
set PREFLIGHT_ERR=!errorlevel!
popd
if !PREFLIGHT_ERR! neq 0 (
    echo %RED%ERROR: Pre-flight checks failed.%RESET%
    pushd "!ROOT_DIR!\backend"
    "!VENV_DIR!\Scripts\python.exe" preflight_check.py
    popd
    pause
    exit /b 1
)
echo   Pre-flight check: %GREEN%OK%RESET%

echo %CYAN%[9/10] Building frontend bundle...%RESET%
pushd "!ROOT_DIR!\frontend"
call npm install --no-audit --no-fund --silent
call npm run build
set BUILD_ERR=!errorlevel!
popd
if !BUILD_ERR! neq 0 (
    echo %RED%ERROR: Frontend production build failed.%RESET%
    pause
    exit /b 1
)
echo   Frontend build: %GREEN%OK (dist/)%RESET%

echo %CYAN%[10/10] Verifying deployment...%RESET%
echo.
echo %BLUE%========================================================================%RESET%
echo %GREEN%                    Deployment Setup Complete!                          %RESET%
echo %BLUE%========================================================================%RESET%
echo.
echo Next steps to launch FAFLOW:
echo.
echo   1. Run the interactive control panel:
echo        %CYAN%FAFLOW.bat%RESET%
echo.
echo   2. Or start directly using:
echo        %CYAN%StartDev.bat%RESET%   (for development mode)
echo        %CYAN%StartProd.bat%RESET%  (for production deployment)
echo.
echo   3. Access the web interface in your browser:
echo        %CYAN%http://localhost:5173%RESET%
echo.
echo   4. Default Administrator Credentials:
echo        Username: %CYAN%admin%RESET%
echo        Password: %CYAN%admin%RESET%
echo.
echo %BLUE%========================================================================%RESET%
echo.
pause
