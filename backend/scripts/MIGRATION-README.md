# Migration Pipeline Documentation

## Overview

This migration pipeline handles the complete process of restoring a MongoDB backup from the old database schema and transforming it to match the new Prisma schema.

## Quick Start

### Using PowerShell (Recommended for Windows)

```powershell
# Navigate to backend directory
cd backend

# Run with default backup file
.\scripts\run-migration-pipeline.ps1

# Run with custom backup file
.\scripts\run-migration-pipeline.ps1 "D:\path\to\your\backup.gz"
```

### Using npm scripts

```bash
# Run the full migration pipeline
npm run db:migration-pipeline

# Run with custom backup file
npx ts-node scripts/migration-pipeline.ts "D:\path\to\your\backup.gz"

# Dry run (preview changes without applying)
npm run db:migration-pipeline:dry
```

## What the Pipeline Does

### Step 1: Backup Restoration
- Restores the MongoDB backup using `mongorestore`
- Maps namespaces from `internship.*` to `college.*`
- Drops existing collections and replaces with backup data

### Step 2: Data Transformation
Transforms data to match the new schema:

| Collection | Changes |
|------------|---------|
| **User** | Adds `loginCount`, `hasChangedDefaultPassword` |
| **Student** | Renames `feeStuctureId` → `feeStructureId` (typo fix) |
| **FacultyVisitLog** | Adds `status`, `latitude`, `longitude`, `visitMonth`, `visitYear`, `isMonthlyVisit` |
| **InternshipApplication** | Adds `reportsGenerated`, `totalExpectedReports`, `totalExpectedVisits` |
| **MonthlyReport** | Adds submission window fields, `isOverdue`, `isPartialMonth`, `isFinalReport` |
| **Grievance** | Adds `escalationLevel`, creates `GrievanceStatusHistory` entries |

Also:
- Archives removed collections (FCMToken, Event, EventRegistration)
- Adds default values for new required fields
- Creates database indexes

### Step 3: Institution Updates
Updates all 23 Punjab Government Polytechnic institutions with:
- Full official names and addresses
- District, city, and pin codes
- Official contact emails and phone numbers
- Website URLs
- Establishment years
- Affiliation and recognition details

### Step 4: Prisma Client Regeneration
- Runs `npx prisma generate` to regenerate the Prisma client

## Configuration Options

Set these environment variables before running:

| Variable | Description | Default |
|----------|-------------|---------|
| `DRY_RUN` | Preview changes without applying | `false` |
| `SKIP_RESTORE` | Skip backup restoration step | `false` |
| `SKIP_TRANSFORM` | Skip data transformation step | `false` |
| `SKIP_INSTITUTIONS` | Skip institution updates | `false` |
| `SKIP_PRISMA` | Skip Prisma client regeneration | `false` |

### Example: Dry Run

```powershell
$env:DRY_RUN = "true"
npm run db:migration-pipeline
```

### Example: Skip Restore (transform only)

```powershell
$env:SKIP_RESTORE = "true"
npm run db:migration-pipeline
```

## Prerequisites

1. **MongoDB Database Tools** - Required for `mongorestore`
   - Download from: https://www.mongodb.com/try/download/database-tools
   - Or the script will look for it in:
     - System PATH
     - `../../mongodb-database-tools-windows-x86_64-100.9.4/bin/`
     - `C:/Program Files/MongoDB/Tools/100/bin/`

2. **Node.js & npm** - For running the TypeScript scripts

3. **Environment Variables** - `.env` file with `DATABASE_URL`

## File Structure

```
backend/scripts/
├── migration-pipeline.ts      # Main pipeline script
├── run-migration-pipeline.ps1 # PowerShell wrapper
├── migrate-old-to-new-schema.ts  # Standalone transformation script
├── update-institutions.ts     # Standalone institution update script
├── fix-remaining-institutions.ts # Fix script for unmatched institutions
├── list-institutions.ts       # Utility to list all institutions
└── MIGRATION-README.md        # This documentation
```

## Backup File Requirements

- **Format**: gzip compressed MongoDB archive (`.gz`)
- **Source Database**: `internship`
- **Target Database**: `college` (as specified in DATABASE_URL)

## Logs

Migration logs are saved to:
```
backend/logs/migration-pipeline.log
```

## Troubleshooting

### mongorestore not found
Install MongoDB Database Tools:
```powershell
# Download and extract to project root
# The script will auto-detect: mongodb-database-tools-windows-x86_64-100.9.4/bin/mongorestore.exe
```

### Authentication error
Ensure your `DATABASE_URL` in `.env` includes credentials:
```
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/college"
```

### 0 documents restored
Check that the backup is from the correct database. The pipeline maps:
- From: `internship.*`
- To: `college.*`

If your backup uses a different database name, update `CONFIG.SOURCE_DATABASE` in `migration-pipeline.ts`.

## Running Individual Steps

### Transform only (data already restored)
```bash
npm run db:migrate-old-data
```

### Update institutions only
```bash
npm run db:update-institutions
```

### Regenerate Prisma client only
```bash
npx prisma generate
```

## Schema Changes Summary

### Removed Models
- `FCMToken` - Archived to `_archived_fcm_tokens_*`
- `Event` - Archived if exists
- `EventRegistration` - Archived if exists

### New Models
- `GrievanceStatusHistory`
- `UserSession`
- `TokenBlacklist`
- `SupportTicket`
- `SupportResponse`
- `FAQArticle`
- `BulkJob`
- `BackupRecord`
- `BackupSchedule`
- `SystemConfig`

### Field Changes
See Step 2 above for detailed field changes per collection.
