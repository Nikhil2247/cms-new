#
# =============================================================================
# MIGRATION PIPELINE RUNNER (PowerShell)
# =============================================================================
#
# This script runs the complete migration pipeline for restoring and
# transforming MongoDB data to the new Prisma schema.
#
# USAGE:
#   .\scripts\run-migration-pipeline.ps1 [backup_file_path]
#
# EXAMPLES:
#   .\scripts\run-migration-pipeline.ps1
#   .\scripts\run-migration-pipeline.ps1 "D:\backups\mongodb_backup.gz"
#
# OPTIONS (set as environment variables before running):
#   $env:DRY_RUN = "true"           # Preview changes without applying
#   $env:SKIP_RESTORE = "true"      # Skip backup restoration
#   $env:SKIP_TRANSFORM = "true"    # Skip data transformation
#   $env:SKIP_INSTITUTIONS = "true" # Skip institution updates
#   $env:SKIP_PRISMA = "true"       # Skip Prisma client regeneration
#
# =============================================================================

param(
    [Parameter(Position=0)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $BackendDir

# Default backup path if not provided
if (-not $BackupFile) {
    $BackupFile = Join-Path $ProjectRoot "prisma backup\mongodb_backup_2025-12-25_18-00-01.gz"
}

# Display banner
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "           MIGRATION PIPELINE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backup File: $BackupFile"
Write-Host "Backend Dir: $BackendDir"
Write-Host ""

# Check if backup file exists
if (-not (Test-Path $BackupFile)) {
    Write-Host "ERROR: Backup file not found: $BackupFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage: .\run-migration-pipeline.ps1 [backup_file_path]" -ForegroundColor Yellow
    exit 1
}

# Confirm execution
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  1. DROP and restore the database from backup" -ForegroundColor Yellow
Write-Host "  2. Transform data to match new schema" -ForegroundColor Yellow
Write-Host "  3. Update institutions with verified details" -ForegroundColor Yellow
Write-Host "  4. Regenerate Prisma client" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Migration cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Starting migration pipeline..." -ForegroundColor Green
Write-Host ""

# Change to backend directory
Set-Location $BackendDir

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Run the migration pipeline
try {
    npx ts-node scripts/migration-pipeline.ts "$BackupFile"

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: Migration pipeline failed!" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host ""
    Write-Host "ERROR: Migration pipeline failed with exception!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "           MIGRATION COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
