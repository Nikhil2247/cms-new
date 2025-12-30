@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM MongoDB to PostgreSQL Server Migration Script (Windows)
REM
REM Prerequisites:
REM   1. Node.js (v18+) and npm installed
REM   2. Project dependencies installed (npm install)
REM   3. Prisma migrations applied on target PostgreSQL
REM   4. Network access to both MongoDB and PostgreSQL servers
REM
REM Usage:
REM   run-server-migration.bat
REM
REM Or set environment variables:
REM   set SOURCE_MONGODB_URL=mongodb://...
REM   set TARGET_DATABASE_URL=postgresql://...
REM   run-server-migration.bat
REM ============================================================================

echo.
echo ============================================================
echo   MongoDB to PostgreSQL Server Migration
echo ============================================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed
    echo Please install Node.js v18+ and try again
    exit /b 1
)

REM Get script directory and project directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

REM Change to project directory
cd /d "%PROJECT_DIR%"

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Check for Prisma client
if not exist "node_modules\.prisma" (
    echo Generating Prisma client...
    call npx prisma generate
)

REM Check for MongoDB URL
if "%SOURCE_MONGODB_URL%"=="" (
    echo MongoDB URL not provided via SOURCE_MONGODB_URL environment variable.
    set /p "MONGODB_URL=Enter MongoDB URL (source server): "
) else (
    set "MONGODB_URL=%SOURCE_MONGODB_URL%"
)

if "%MONGODB_URL%"=="" (
    echo ERROR: MongoDB URL is required
    exit /b 1
)

REM Check for PostgreSQL URL
if "%TARGET_DATABASE_URL%"=="" (
    echo PostgreSQL URL not provided via TARGET_DATABASE_URL environment variable.
    set /p "POSTGRES_URL=Enter PostgreSQL URL (target server): "
) else (
    set "POSTGRES_URL=%TARGET_DATABASE_URL%"
)

if "%POSTGRES_URL%"=="" (
    echo ERROR: PostgreSQL URL is required
    exit /b 1
)

echo.
echo Configuration:
echo   MongoDB URL: [provided]
echo   PostgreSQL URL: [provided]
echo.

REM Confirm before proceeding
set /p "CONFIRM=WARNING: This will clear the target PostgreSQL database. Continue? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo Migration cancelled.
    exit /b 0
)

echo.
echo Starting migration...
echo.

REM Run the migration
call npx ts-node prisma/server-migrate-mongo-to-postgres.ts --mongodb-url "%MONGODB_URL%" --postgres-url "%POSTGRES_URL%"

if errorlevel 1 (
    echo.
    echo ============================================================
    echo   Migration FAILED
    echo ============================================================
    exit /b 1
) else (
    echo.
    echo ============================================================
    echo   Migration completed successfully!
    echo ============================================================
)

endlocal
