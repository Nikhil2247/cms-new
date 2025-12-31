# ============================================================================
# PostgreSQL Database Restore Script (PowerShell)
# ============================================================================
# Usage: .\restore-database.ps1 -BackupFile <path>
#
# This script restores the CMS PostgreSQL database from a backup file.
# WARNING: This will overwrite all existing data in the database!
# ============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [switch]$Force
)

# --- Configuration ---
$DB_HOST = $env:DB_HOST ?? "localhost"
$DB_PORT = $env:DB_PORT ?? "5432"
$DB_NAME = $env:DB_NAME ?? "cms_db"
$DB_USER = $env:DB_USER ?? "postgres"
$DB_PASSWORD = $env:DB_PASSWORD ?? "postgres123"

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Database Restore" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# --- Verify backup file exists ---
if (!(Test-Path $BackupFile)) {
    Write-Host "ERROR: Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

$fileInfo = Get-Item $BackupFile
Write-Host "Database:    $DB_NAME"
Write-Host "Host:        ${DB_HOST}:${DB_PORT}"
Write-Host "Backup file: $BackupFile"
Write-Host "File size:   $([math]::Round($fileInfo.Length / 1MB, 2)) MB"
Write-Host ""

# --- Confirm restore ---
if (!$Force) {
    Write-Host "WARNING: This will DROP and RECREATE the database!" -ForegroundColor Red
    Write-Host "All existing data will be PERMANENTLY LOST!" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "Type 'YES' to confirm restore"
    if ($confirm -ne "YES") {
        Write-Host "Restore cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# --- Set password environment variable ---
$env:PGPASSWORD = $DB_PASSWORD

try {
    # --- Check if psql exists ---
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if (!$psql) {
        $pgPaths = @(
            "C:\Program Files\PostgreSQL\16\bin\psql.exe",
            "C:\Program Files\PostgreSQL\15\bin\psql.exe",
            "C:\Program Files\PostgreSQL\14\bin\psql.exe",
            "C:\Program Files\PostgreSQL\13\bin\psql.exe"
        )
        foreach ($path in $pgPaths) {
            if (Test-Path $path) {
                $psql = $path
                break
            }
        }
        if (!$psql) {
            throw "psql not found. Please ensure PostgreSQL client tools are installed and in PATH."
        }
    }

    $psqlPath = if ($psql -is [System.Management.Automation.ApplicationInfo]) { $psql.Source } else { $psql }

    # --- Decompress if needed ---
    $restoreFile = $BackupFile
    $tempFile = $null

    if ($BackupFile -match "\.gz$") {
        Write-Host "Decompressing backup file..." -ForegroundColor Yellow
        $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"

        $inputStream = [System.IO.File]::OpenRead($BackupFile)
        $gzipStream = New-Object System.IO.Compression.GZipStream($inputStream, [System.IO.Compression.CompressionMode]::Decompress)
        $outputStream = [System.IO.File]::Create($tempFile)

        $gzipStream.CopyTo($outputStream)

        $outputStream.Close()
        $gzipStream.Close()
        $inputStream.Close()

        $restoreFile = $tempFile
        Write-Host "Decompressed to temporary file." -ForegroundColor Green
    }

    # --- Drop and recreate database ---
    Write-Host ""
    Write-Host "Dropping existing database..." -ForegroundColor Yellow

    $dropResult = & $psqlPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Could not drop database (it may not exist or have active connections)" -ForegroundColor Yellow
    }

    Write-Host "Creating database..." -ForegroundColor Yellow
    $createResult = & $psqlPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create database: $createResult"
    }

    # --- Restore from backup ---
    Write-Host ""
    Write-Host "Restoring database from backup..." -ForegroundColor Yellow
    Write-Host "This may take a few minutes for large databases..."
    Write-Host ""

    $process = Start-Process -FilePath $psqlPath `
        -ArgumentList "-h", $DB_HOST, "-p", $DB_PORT, "-U", $DB_USER, "-d", $DB_NAME, "-f", $restoreFile `
        -Wait -NoNewWindow -PassThru -RedirectStandardError "NUL"

    if ($process.ExitCode -ne 0) {
        throw "Restore failed with exit code $($process.ExitCode)"
    }

    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host "Database restored successfully!" -ForegroundColor Green
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Verify the data in your application"
    Write-Host "  2. Run 'npx prisma generate' if needed"
    Write-Host ""

}
catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    # Cleanup
    $env:PGPASSWORD = $null
    if ($tempFile -and (Test-Path $tempFile)) {
        Remove-Item $tempFile -Force
    }
}
