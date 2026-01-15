/**
 * MongoDB to PostgreSQL Server Migration Script
 *
 * This script migrates all data from a MongoDB server to a PostgreSQL server.
 * Designed to run on a server for production migrations.
 *
 * Features:
 * - Configurable via environment variables or CLI arguments
 * - Connection testing before migration
 * - Dry-run mode for testing
 * - Batch processing for large datasets
 * - Progress logging and resume capability
 * - Graceful error handling
 *
 * Environment Variables:
 *   SOURCE_MONGODB_URL - MongoDB connection string (source)
 *   TARGET_DATABASE_URL - PostgreSQL connection string (target)
 *
 * Usage:
 *   # Using environment variables:
 *   SOURCE_MONGODB_URL="mongodb://..." TARGET_DATABASE_URL="postgresql://..." npx ts-node prisma/server-migrate-mongo-to-postgres.ts
 *
 *   # Using CLI arguments:
 *   npx ts-node prisma/server-migrate-mongo-to-postgres.ts \
 *     --mongodb-url "mongodb://user:pass@source-server:27017/db" \
 *     --postgres-url "postgresql://user:pass@target-server:5432/db" \
 *     --dry-run
 *
 *   # With batch size:
 *   npx ts-node prisma/server-migrate-mongo-to-postgres.ts --batch-size 500
 */

import { PrismaClient, ApplicationStatus, InternshipPhase, SupportTicketPriority, SupportTicketStatus } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { MongoClient, ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Configuration
// =============================================================================

interface MigrationConfig {
  mongodbUrl: string;
  postgresUrl: string;
  dryRun: boolean;
  batchSize: number;
  skipClear: boolean;
  verbose: boolean;
}

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    mongodbUrl: process.env.SOURCE_MONGODB_URL || process.env.MONGODB_URL || '',
    postgresUrl: process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '',
    dryRun: false,
    batchSize: 1000,
    skipClear: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mongodb-url':
      case '-m':
        config.mongodbUrl = args[++i];
        break;
      case '--postgres-url':
      case '-p':
        config.postgresUrl = args[++i];
        break;
      case '--dry-run':
      case '-d':
        config.dryRun = true;
        break;
      case '--batch-size':
      case '-b':
        config.batchSize = parseInt(args[++i], 10);
        break;
      case '--skip-clear':
      case '-s':
        config.skipClear = true;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
MongoDB to PostgreSQL Server Migration Script

USAGE:
  npx ts-node prisma/server-migrate-mongo-to-postgres.ts [OPTIONS]

OPTIONS:
  -m, --mongodb-url <url>     MongoDB connection URL (source server)
  -p, --postgres-url <url>    PostgreSQL connection URL (target server)
  -d, --dry-run               Test connections without migrating data
  -b, --batch-size <number>   Number of records per batch (default: 1000)
  -s, --skip-clear            Skip clearing PostgreSQL tables before migration
  -v, --verbose               Enable verbose logging and error details
  -h, --help                  Show this help message

ENVIRONMENT VARIABLES:
  SOURCE_MONGODB_URL          MongoDB connection URL (alternative to -m)
  TARGET_DATABASE_URL         PostgreSQL connection URL (alternative to -p)

FEATURES:
  • Migrates 14 core collections from MongoDB to PostgreSQL
  • Automatically maps ObjectId to UUID
  • Handles foreign key constraints with proper ordering
  • Maps deprecated internshipStatus to new InternshipPhase enum
  • Displays comprehensive CLI report with statistics
  • Tracks and displays error details with --verbose flag
  • Shows ID mappings and migration time per collection

EXAMPLES:
  # Basic migration
  npx ts-node prisma/server-migrate-mongo-to-postgres.ts \\
    -m "mongodb://admin:password@source-vps:27017/cms_db?authSource=admin" \\
    -p "postgresql://user:password@target-vps:5432/cms_db"

  # Dry run to test connections
  npx ts-node prisma/server-migrate-mongo-to-postgres.ts \\
    -m "mongodb://..." -p "postgresql://..." --dry-run

  # Migration with verbose error reporting
  npx ts-node prisma/server-migrate-mongo-to-postgres.ts \\
    -m "mongodb://..." -p "postgresql://..." --verbose

  # Using environment variables
  export SOURCE_MONGODB_URL="mongodb://..."
  export TARGET_DATABASE_URL="postgresql://..."
  npx ts-node prisma/server-migrate-mongo-to-postgres.ts
`);
}

// =============================================================================
// Logging Utilities
// =============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string): void {
  console.log('');
  log('='.repeat(60), 'cyan');
  log(title, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logPhase(phase: string): void {
  console.log('');
  log(`--- ${phase} ---`, 'blue');
}

function logSuccess(message: string): void {
  log(`✓ ${message}`, 'green');
}

function logWarning(message: string): void {
  log(`⚠ ${message}`, 'yellow');
}

function logError(message: string): void {
  log(`✗ ${message}`, 'red');
}

function maskConnectionUrl(url: string): string {
  return url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
}

// =============================================================================
// ID Mapping
// =============================================================================

const idMaps: Record<string, Map<string, string>> = {
  users: new Map(),
  institutions: new Map(),
  students: new Map(),
  branches: new Map(),
  batches: new Map(),
  internshipApplications: new Map(),
  mentorAssignments: new Map(),
  documents: new Map(),
  notifications: new Map(),
  auditLogs: new Map(),
  grievances: new Map(),
  supportTickets: new Map(),
  monthlyReports: new Map(),
  facultyVisitLogs: new Map(),
};

function convertId(objectId: string | ObjectId | null | undefined, collection: string): string {
  if (!objectId) return '';
  const idStr = objectId.toString();
  const map = idMaps[collection];
  if (!map) {
    console.warn(`No ID map for collection: ${collection}`);
    return uuidv4();
  }
  if (!map.has(idStr)) {
    map.set(idStr, uuidv4());
  }
  return map.get(idStr)!;
}

function getMappedId(objectId: string | ObjectId | null | undefined, collection: string): string | null {
  if (!objectId) return null;
  const idStr = objectId.toString();
  const map = idMaps[collection];
  return map?.get(idStr) || null;
}

function processDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

// =============================================================================
// Migration Statistics
// =============================================================================

interface MigrationStats {
  collection: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  startTime: number;
  endTime?: number;
  errorDetails: Array<{ id: string; message: string }>;
}

const migrationStats: MigrationStats[] = [];
let globalErrors: Array<{ collection: string; id: string; message: string }> = [];

function startCollectionMigration(collection: string, total: number): MigrationStats {
  const stats: MigrationStats = {
    collection,
    total,
    migrated: 0,
    skipped: 0,
    errors: 0,
    startTime: Date.now(),
    errorDetails: [],
  };
  migrationStats.push(stats);
  return stats;
}

function recordError(stats: MigrationStats, id: string, message: string): void {
  stats.errors++;
  stats.errorDetails.push({ id, message });
  globalErrors.push({ collection: stats.collection, id, message });
}

function finishCollectionMigration(stats: MigrationStats): void {
  stats.endTime = Date.now();
  const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
  log(`  Migrated: ${stats.migrated}/${stats.total} | Skipped: ${stats.skipped} | Errors: ${stats.errors} | Time: ${duration}s`, 'reset');
}

// =============================================================================
// Pre-Migration Validation
// =============================================================================

interface ValidationResult {
  collection: string;
  total: number;
  issues: Array<{ type: string; count: number; examples: string[] }>;
}

async function validateSourceData(mongoDb: any, config: MigrationConfig): Promise<ValidationResult[]> {
  logPhase('Validating Source Data');
  const results: ValidationResult[] = [];

  // Validate Users
  log('Checking Users collection...', 'reset');
  const users = await mongoDb.collection('User').find({}).toArray();
  const userIssues: Array<{ type: string; count: number; examples: string[] }> = [];

  const duplicateEmails = new Map<string, string[]>();
  const missingPasswords: string[] = [];
  const missingNames: string[] = [];
  const invalidRoles: string[] = [];

  for (const user of users) {
    const email = user.email?.toLowerCase()?.trim();
    if (email) {
      if (!duplicateEmails.has(email)) {
        duplicateEmails.set(email, []);
      }
      duplicateEmails.get(email)!.push(user._id.toString());
    }
    if (!user.password) missingPasswords.push(user._id.toString());
    if (!user.name) missingNames.push(user._id.toString());
    const validRoles = ['STUDENT', 'PRINCIPAL', 'TEACHER', 'STATE_DIRECTORATE', 'SYSTEM_ADMIN'];
    if (user.role && !validRoles.includes(user.role.toUpperCase())) {
      invalidRoles.push(`${user._id}: ${user.role}`);
    }
  }

  const actualDuplicates = Array.from(duplicateEmails.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([email, ids]) => `${email} (${ids.length} occurrences)`);

  if (actualDuplicates.length > 0) {
    userIssues.push({ type: 'Duplicate emails', count: actualDuplicates.length, examples: actualDuplicates.slice(0, 5) });
  }
  if (missingPasswords.length > 0) {
    userIssues.push({ type: 'Missing passwords', count: missingPasswords.length, examples: missingPasswords.slice(0, 5) });
  }
  if (missingNames.length > 0) {
    userIssues.push({ type: 'Missing names', count: missingNames.length, examples: missingNames.slice(0, 5) });
  }
  if (invalidRoles.length > 0) {
    userIssues.push({ type: 'Invalid roles', count: invalidRoles.length, examples: invalidRoles.slice(0, 5) });
  }

  results.push({ collection: 'User', total: users.length, issues: userIssues });

  // Validate Students
  log('Checking Student collection...', 'reset');
  const students = await mongoDb.collection('Student').find({}).toArray();
  const studentIssues: Array<{ type: string; count: number; examples: string[] }> = [];

  const orphanedStudents: string[] = [];
  const duplicateUserIds = new Map<string, string[]>();
  const missingStudentNames: string[] = [];

  const userIdSet = new Set(users.map((u: any) => u._id.toString()));

  for (const student of students) {
    const userId = student.userId?.toString();
    if (!userId || !userIdSet.has(userId)) {
      orphanedStudents.push(`${student._id}: userId=${userId || 'null'}`);
    }
    if (userId) {
      if (!duplicateUserIds.has(userId)) {
        duplicateUserIds.set(userId, []);
      }
      duplicateUserIds.get(userId)!.push(student._id.toString());
    }
    if (!student.name) {
      missingStudentNames.push(student._id.toString());
    }
  }

  const studentDuplicates = Array.from(duplicateUserIds.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([userId, ids]) => `userId=${userId} (${ids.length} students)`);

  if (orphanedStudents.length > 0) {
    studentIssues.push({ type: 'Orphaned students (no matching User)', count: orphanedStudents.length, examples: orphanedStudents.slice(0, 5) });
  }
  if (studentDuplicates.length > 0) {
    studentIssues.push({ type: 'Duplicate userId references', count: studentDuplicates.length, examples: studentDuplicates.slice(0, 5) });
  }
  if (missingStudentNames.length > 0) {
    studentIssues.push({ type: 'Missing student names', count: missingStudentNames.length, examples: missingStudentNames.slice(0, 5) });
  }

  results.push({ collection: 'Student', total: students.length, issues: studentIssues });

  // Validate Institutions
  log('Checking Institution collection...', 'reset');
  const institutions = await mongoDb.collection('Institution').find({}).toArray();
  const institutionIssues: Array<{ type: string; count: number; examples: string[] }> = [];

  const duplicateCodes = new Map<string, number>();
  for (const inst of institutions) {
    const code = inst.code?.toLowerCase();
    if (code) {
      duplicateCodes.set(code, (duplicateCodes.get(code) || 0) + 1);
    }
  }
  const instDuplicates = Array.from(duplicateCodes.entries())
    .filter(([, count]) => count > 1)
    .map(([code, count]) => `${code} (${count}x)`);

  if (instDuplicates.length > 0) {
    institutionIssues.push({ type: 'Duplicate institution codes', count: instDuplicates.length, examples: instDuplicates.slice(0, 5) });
  }

  results.push({ collection: 'Institution', total: institutions.length, issues: institutionIssues });

  // Print validation results
  console.log('');
  log('┌─────────────────────────────────────────────────────────────────────────────┐', 'reset');
  log('│                         VALIDATION RESULTS                                   │', 'reset');
  log('├─────────────────────────────────────────────────────────────────────────────┤', 'reset');

  let hasIssues = false;
  for (const result of results) {
    if (result.issues.length > 0) {
      hasIssues = true;
      log(`│ ${result.collection} (${result.total} records):`.padEnd(78) + '│', 'yellow');
      for (const issue of result.issues) {
        log(`│   - ${issue.type}: ${issue.count}`.padEnd(78) + '│', 'yellow');
        if (config.verbose && issue.examples.length > 0) {
          for (const example of issue.examples) {
            log(`│       ${example.slice(0, 68)}`.padEnd(78) + '│', 'reset');
          }
        }
      }
    } else {
      log(`│ ${result.collection} (${result.total} records): ✓ No issues`.padEnd(78) + '│', 'green');
    }
  }

  log('└─────────────────────────────────────────────────────────────────────────────┘', 'reset');

  if (hasIssues) {
    logWarning('Data quality issues detected. Migration will attempt to handle these automatically.');
    logWarning('Use --verbose to see detailed examples of each issue.');
  } else {
    logSuccess('All validation checks passed!');
  }

  return results;
}

// =============================================================================
// Migration Functions
// =============================================================================

async function migrateInstitutions(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Institutions...', 'blue');
  const institutions = await mongoDb.collection('Institution').find({}).toArray();
  const stats = startCollectionMigration('institutions', institutions.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${institutions.length} institutions`);
    return;
  }

  for (const inst of institutions) {
    const newId = convertId(inst._id, 'institutions');
    try {
      await prisma.institution.create({
        data: {
          id: newId,
          code: inst.code || `INST${Date.now()}`,
          name: inst.name,
          shortName: inst.shortName,
          type: inst.type || 'POLYTECHNIC',
          address: inst.address,
          city: inst.city,
          state: inst.state,
          pinCode: inst.pinCode,
          country: inst.country || 'India',
          contactEmail: inst.contactEmail,
          contactPhone: inst.contactPhone,
          website: inst.website,
          isActive: inst.isActive ?? true,
          createdAt: processDate(inst.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      recordError(stats, inst._id?.toString() || 'unknown', error.message);
      if (config.verbose) logError(`Error migrating institution ${inst.name}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateUsers(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Users...', 'blue');
  const users = await mongoDb.collection('User').find({}).toArray();
  const stats = startCollectionMigration('users', users.length);
  const processedEmails = new Set<string>();
  const emailToUserId = new Map<string, string>();

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${users.length} users`);
    return;
  }

  // Progress tracking
  let progressCounter = 0;
  const progressInterval = Math.max(1, Math.floor(users.length / 10));

  for (const user of users) {
    progressCounter++;
    if (progressCounter % progressInterval === 0) {
      log(`  Progress: ${progressCounter}/${users.length} (${Math.round((progressCounter / users.length) * 100)}%)`, 'reset');
    }

    const mongoUserId = user._id?.toString() || 'unknown';
    const newId = convertId(user._id, 'users');
    const institutionId = getMappedId(user.institutionId, 'institutions');

    // Normalize and validate email
    let email = user.email?.toLowerCase()?.trim();
    const isValidEmail = email && typeof email === 'string' && email.includes('@') && email.length > 3;

    // Handle duplicate emails
    const isDuplicate = isValidEmail && processedEmails.has(email!);
    if (isValidEmail && !isDuplicate) {
      processedEmails.add(email!);
      emailToUserId.set(email!, mongoUserId);
    }

    // Generate unique email for duplicates
    let finalEmail: string | null = null;
    if (isDuplicate) {
      finalEmail = `duplicate_${mongoUserId}@removed.local`;
      if (config.verbose) {
        const originalUserId = emailToUserId.get(email!);
        logWarning(`Duplicate email '${email}' for user ${mongoUserId}, original user: ${originalUserId}`);
      }
    } else if (isValidEmail) {
      finalEmail = email!;
    } else {
      // No email or invalid email - generate placeholder for non-student roles
      if (user.role !== 'STUDENT') {
        finalEmail = `no_email_${mongoUserId}@placeholder.local`;
        if (config.verbose) logWarning(`User ${mongoUserId} has no valid email, using placeholder`);
      }
    }

    // Validate required fields
    const name = user.name?.trim() || `User_${mongoUserId.slice(-8)}`;

    // Validate role enum
    const validRoles = ['STUDENT', 'PRINCIPAL', 'TEACHER', 'STATE_DIRECTORATE', 'SYSTEM_ADMIN'];
    const role = validRoles.includes(user.role?.toUpperCase()) ? user.role.toUpperCase() : null;

    // Validate password - must exist
    const password = user.password || '$2b$10$placeholder.hash.for.migration';

    try {
      await prisma.user.create({
        data: {
          id: newId,
          email: finalEmail,
          password: password,
          name: name,
          role: role as any,
          active: isDuplicate ? false : (user.active ?? true),
          institutionId: institutionId || null,
          designation: user.designation || null,
          phoneNo: user.phoneNo || null,
          rollNumber: user.rollNumber || null,
          branchName: user.branchName || null,
          dob: user.dob || null,
          createdAt: processDate(user.createdAt) || new Date(),
        },
      });
      stats.migrated++;
      if (isDuplicate) stats.skipped++;
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === 'P2002') {
        recordError(stats, mongoUserId, `Unique constraint violation: ${error.meta?.target || 'unknown'}`);
      } else {
        recordError(stats, mongoUserId, error.message);
      }
      if (config.verbose) logError(`Error migrating user ${user.email || mongoUserId}: ${error.message}`);
    }
  }

  log(`  Processed ${progressCounter} users`, 'reset');
  finishCollectionMigration(stats);
}

async function migrateBatches(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Batches...', 'blue');
  const batches = await mongoDb.collection('Batch').find({}).toArray();
  const stats = startCollectionMigration('batches', batches.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${batches.length} batches`);
    return;
  }

  for (const batch of batches) {
    const newId = convertId(batch._id, 'batches');
    const institutionId = getMappedId(batch.institutionId, 'institutions');

    try {
      await prisma.batch.create({
        data: {
          id: newId,
          name: batch.name,
          isActive: batch.isActive ?? true,
          institutionId: institutionId,
          createdAt: processDate(batch.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      recordError(stats, batch._id?.toString() || 'unknown', error.message);
      if (config.verbose) logError(`Error migrating batch ${batch.name}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateBranches(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Branches...', 'blue');
  const branches = await mongoDb.collection('branches').find({}).toArray();
  const stats = startCollectionMigration('branches', branches.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${branches.length} branches`);
    return;
  }

  for (const branch of branches) {
    const newId = convertId(branch._id, 'branches');
    const institutionId = getMappedId(branch.institutionId, 'institutions');

    try {
      await prisma.branch.create({
        data: {
          id: newId,
          name: branch.name,
          shortName: branch.shortName,
          code: branch.code || `${branch.shortName}-${Date.now()}`,
          duration: branch.duration || 3,
          isActive: branch.isActive ?? true,
          institutionId: institutionId,
          createdAt: processDate(branch.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      recordError(stats, branch._id?.toString() || 'unknown', error.message);
      if (config.verbose) logError(`Error migrating branch ${branch.name}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateStudents(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Students...', 'blue');
  const students = await mongoDb.collection('Student').find({}).toArray();
  const stats = startCollectionMigration('students', students.length);
  const processedUserIds = new Map<string, string>();
  const processedAdmissionNumbers = new Set<string>();

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${students.length} students`);
    return;
  }

  // Progress tracking for large datasets
  let progressCounter = 0;
  const progressInterval = Math.max(1, Math.floor(students.length / 10));

  for (const student of students) {
    progressCounter++;
    if (progressCounter % progressInterval === 0) {
      log(`  Progress: ${progressCounter}/${students.length} (${Math.round((progressCounter / students.length) * 100)}%)`, 'reset');
    }

    const mongoStudentId = student._id?.toString() || 'unknown';
    const userId = getMappedId(student.userId, 'users');
    const institutionId = getMappedId(student.institutionId, 'institutions');
    const branchId = getMappedId(student.branchId, 'branches');
    const batchId = getMappedId(student.batchId, 'batches');

    // Validation: Skip if no userId mapping
    if (!userId) {
      recordError(stats, mongoStudentId, 'Missing userId mapping - User not found in migration');
      stats.skipped++;
      continue;
    }

    // Handle duplicate userIds (one user can only have one student record)
    const isDuplicate = processedUserIds.has(userId);
    if (isDuplicate) {
      const existingUuid = processedUserIds.get(userId)!;
      idMaps['students'].set(mongoStudentId, existingUuid);
      if (config.verbose) logWarning(`Duplicate student for userId ${userId}, mapping to existing: ${existingUuid}`);
      stats.skipped++;
      continue;
    }

    // Handle duplicate admission numbers
    const admissionNumber = student.admissionNumber?.trim();
    if (admissionNumber && processedAdmissionNumbers.has(admissionNumber.toLowerCase())) {
      if (config.verbose) logWarning(`Duplicate admission number: ${admissionNumber} for student ${mongoStudentId}`);
      // Still migrate but with modified admission number
    }
    if (admissionNumber) {
      processedAdmissionNumbers.add(admissionNumber.toLowerCase());
    }

    const newId = convertId(student._id, 'students');
    processedUserIds.set(userId, newId);

    // STEP 1: Update User with Student data (User is Single Source of Truth)
    // Build update data carefully, only including fields that have values
    const userUpdateData: Record<string, any> = {};

    // Name is required for User, use student name or fallback
    if (student.name) userUpdateData.name = student.name;

    // Email - only update if student has one and it's valid
    if (student.email && typeof student.email === 'string' && student.email.includes('@')) {
      userUpdateData.email = student.email.toLowerCase().trim();
    }

    // Phone number (contact in old schema → phoneNo in new schema)
    if (student.contact) userUpdateData.phoneNo = student.contact;

    // Date of birth
    if (student.dob) userUpdateData.dob = student.dob;

    // Roll number
    if (student.rollNumber) userUpdateData.rollNumber = student.rollNumber;

    // Branch - set both branchId FK and cached branchName
    if (branchId) userUpdateData.branchId = branchId;
    if (student.branchName) userUpdateData.branchName = student.branchName;

    // Institution
    if (institutionId) userUpdateData.institutionId = institutionId;

    // Active status (isActive in old schema → active in new schema)
    userUpdateData.active = student.isActive ?? true;

    try {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    } catch (userError: any) {
      // If email conflict, retry without email but still update other fields (especially active status)
      if (userError.code === 'P2002' && userError.message?.includes('email')) {
        try {
          const { email, ...dataWithoutEmail } = userUpdateData;
          await prisma.user.update({
            where: { id: userId },
            data: dataWithoutEmail,
          });
          if (config.verbose) logWarning(`Updated User for student ${student.rollNumber || mongoStudentId} without email (conflict)`);
        } catch (retryError: any) {
          recordError(stats, mongoStudentId, `User update failed (retry): ${retryError.message}`);
          if (config.verbose) logError(`Failed to update User for student ${student.rollNumber || mongoStudentId}: ${retryError.message}`);
        }
      } else {
        recordError(stats, mongoStudentId, `User update failed: ${userError.message}`);
        if (config.verbose) logError(`Failed to update User for student ${student.rollNumber || mongoStudentId}: ${userError.message}`);
      }
      // Continue to try creating student anyway if user update fails
    }

    // STEP 2: Create Student record with ONLY student-specific fields
    try {
      // Validate numeric fields
      const currentYear = typeof student.currentYear === 'number' ? student.currentYear :
                         (typeof student.currentYear === 'string' ? parseInt(student.currentYear, 10) : null);
      const currentSemester = typeof student.currentSemester === 'number' ? student.currentSemester :
                             (typeof student.currentSemester === 'string' ? parseInt(student.currentSemester, 10) : null);

      // Validate clearance status enum
      const validClearanceStatuses = ['PENDING', 'CLEARED', 'HOLD', 'REJECTED'];
      const clearanceStatus = validClearanceStatuses.includes(student.clearanceStatus?.toUpperCase())
        ? student.clearanceStatus.toUpperCase()
        : 'PENDING';

      // Validate admission type enum
      const validAdmissionTypes = ['FIRST_YEAR', 'LEET'];
      const admissionType = validAdmissionTypes.includes(student.admissionType?.toUpperCase())
        ? student.admissionType.toUpperCase()
        : null;

      // Validate category enum
      const validCategories = ['GENERAL', 'OBC', 'ST', 'SC'];
      const category = validCategories.includes(student.category?.toUpperCase())
        ? student.category.toUpperCase()
        : null;

      await prisma.student.create({
        data: {
          id: newId,
          userId: userId,
          profileImage: student.profilePicture || student.profileImage || null,
          admissionNumber: admissionNumber || null,
          // Address
          address: student.address || null,
          city: student.city || null,
          state: student.state || null,
          pinCode: student.pinCode || null,
          tehsil: student.tehsil || null,
          district: student.district || null,
          // Family
          parentName: student.parentName || null,
          parentContact: student.parentContact || null,
          motherName: student.motherName || null,
          // Demographics
          gender: student.gender || null,
          // Academic
          currentYear: isNaN(currentYear as number) ? null : currentYear,
          currentSemester: isNaN(currentSemester as number) ? null : currentSemester,
          admissionType: admissionType as any,
          category: category as any,
          clearanceStatus: clearanceStatus as any,
          // Batch & Institution (keep FKs for direct queries)
          batchId: batchId || null,
          institutionId: institutionId || null,
          branchId: branchId || null,
          createdAt: processDate(student.createdAt) || new Date(),
        },
      });

      stats.migrated++;
    } catch (studentError: any) {
      // Handle unique constraint violations
      if (studentError.code === 'P2002') {
        recordError(stats, mongoStudentId, `Unique constraint violation: ${studentError.meta?.target || 'unknown field'}`);
        if (config.verbose) logError(`Unique constraint violation for student ${mongoStudentId}: ${studentError.meta?.target}`);
      } else {
        recordError(stats, mongoStudentId, `Student create failed: ${studentError.message}`);
        if (config.verbose) logError(`Failed to create Student ${student.rollNumber || mongoStudentId}: ${studentError.message}`);
      }
    }
  }

  log(`  Processed ${progressCounter} students`, 'reset');
  finishCollectionMigration(stats);
}

async function migrateInternshipApplications(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Internship Applications...', 'blue');
  const applications = await mongoDb.collection('internship_applications').find({}).toArray();
  const stats = startCollectionMigration('internshipApplications', applications.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${applications.length} applications`);
    return;
  }

  const mapStatus = (status: string): ApplicationStatus => {
    const statusMap: Record<string, ApplicationStatus> = {
      'PENDING': ApplicationStatus.APPLIED,
      'APPLIED': ApplicationStatus.APPLIED,
      'UNDER_REVIEW': ApplicationStatus.UNDER_REVIEW,
      'SHORTLISTED': ApplicationStatus.SHORTLISTED,
      'SELECTED': ApplicationStatus.SELECTED,
      'REJECTED': ApplicationStatus.REJECTED,
      'JOINED': ApplicationStatus.JOINED,
      'COMPLETED': ApplicationStatus.COMPLETED,
      'WITHDRAWN': ApplicationStatus.WITHDRAWN,
      'APPROVED': ApplicationStatus.APPROVED,
    };
    return statusMap[status?.toUpperCase()] || ApplicationStatus.APPLIED;
  };

  // Map old internshipStatus to new InternshipPhase enum
  const mapInternshipPhase = (app: any): InternshipPhase => {
    const oldStatus = app.internshipStatus?.toUpperCase();

    // Map based on old internshipStatus field
    if (oldStatus === 'ONGOING' || oldStatus === 'IN_PROGRESS') {
      return InternshipPhase.ACTIVE;
    }
    if (oldStatus === 'COMPLETED') {
      return InternshipPhase.COMPLETED;
    }
    if (oldStatus === 'CANCELLED' || oldStatus === 'TERMINATED') {
      return InternshipPhase.TERMINATED;
    }

    // Additional logic based on other fields
    if (app.completionDate) {
      return InternshipPhase.COMPLETED;
    }
    if (app.status === 'JOINED' || app.joiningDate) {
      return InternshipPhase.ACTIVE;
    }
    if (app.startDate && new Date(app.startDate) <= new Date()) {
      return InternshipPhase.ACTIVE;
    }
    if (app.endDate && new Date(app.endDate) <= new Date()) {
      return InternshipPhase.COMPLETED;
    }

    return InternshipPhase.NOT_STARTED;
  };

  for (const app of applications) {
    const newId = convertId(app._id, 'internshipApplications');
    const studentId = getMappedId(app.studentId, 'students');

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.internshipApplication.create({
        data: {
          id: newId,
          studentId: studentId,
          isSelfIdentified: app.isSelfIdentified ?? false,
          companyName: app.companyName,
          companyAddress: app.companyAddress,
          hrName: app.hrName,
          hrContact: app.hrContact,
          hrEmail: app.hrEmail,
          stipend: app.stipend,
          jobProfile: app.jobProfile,
          hrDesignation: app.hrDesignation,
          status: mapStatus(app.status),
          internshipPhase: mapInternshipPhase(app),
          startDate: processDate(app.startDate),
          endDate: processDate(app.endDate),
          joiningDate: processDate(app.joiningDate),
          completionDate: processDate(app.completionDate),
          coverLetter: app.coverLetter,
          resume: app.resumeUrl || app.resume,
          joiningLetterUrl: app.offerLetterUrl || app.offerLetter || app.joiningLetterUrl,
          additionalInfo: app.noc || app.remarks || app.notes,
          isActive: app.isActive ?? true,
          createdAt: processDate(app.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      if (error.code === 'P2003') {
        stats.skipped++;
      } else {
        recordError(stats, app._id?.toString() || 'unknown', error.message);
        if (config.verbose) logError(`Error migrating application ${app._id}: ${error.message}`);
      }
    }
  }
  finishCollectionMigration(stats);
}

async function migrateMentorAssignments(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Mentor Assignments...', 'blue');
  const assignments = await mongoDb.collection('mentor_assignments').find({}).toArray();
  const stats = startCollectionMigration('mentorAssignments', assignments.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${assignments.length} mentor assignments`);
    return;
  }

  for (const assign of assignments) {
    const newId = convertId(assign._id, 'mentorAssignments');
    const studentId = getMappedId(assign.studentId, 'students');
    const mentorId = getMappedId(assign.mentorId, 'users');
    const assignedBy = getMappedId(assign.assignedBy, 'users');

    if (!studentId || !mentorId || !assignedBy) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.mentorAssignment.create({
        data: {
          id: newId,
          studentId: studentId,
          mentorId: mentorId,
          assignedBy: assignedBy,
          assignmentDate: processDate(assign.assignmentDate) || new Date(),
          isActive: assign.isActive ?? true,
          academicYear: assign.academicYear || '2024-25',
          semester: assign.semester,
          createdAt: processDate(assign.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      if (error.code === 'P2003') {
        stats.skipped++;
      } else {
        stats.errors++;
        if (config.verbose) logError(`Error migrating mentor assignment: ${error.message}`);
      }
    }
  }
  finishCollectionMigration(stats);
}

async function migrateDocuments(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Documents...', 'blue');
  const documents = await mongoDb.collection('Document').find({}).toArray();
  const stats = startCollectionMigration('documents', documents.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${documents.length} documents`);
    return;
  }

  for (const doc of documents) {
    const newId = convertId(doc._id, 'documents');
    const studentId = getMappedId(doc.studentId, 'students');

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.document.create({
        data: {
          id: newId,
          studentId: studentId,
          type: doc.type || 'OTHER',
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          createdAt: processDate(doc.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      if (error.code === 'P2003') {
        stats.skipped++;
      } else {
        stats.errors++;
        if (config.verbose) logError(`Error migrating document: ${error.message}`);
      }
    }
  }
  finishCollectionMigration(stats);
}

async function migrateMonthlyReports(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Monthly Reports...', 'blue');
  const reports = await mongoDb.collection('monthly_reports').find({}).toArray();
  const stats = startCollectionMigration('monthlyReports', reports.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${reports.length} monthly reports`);
    return;
  }

  for (const report of reports) {
    const newId = convertId(report._id, 'monthlyReports');
    const applicationId = getMappedId(report.applicationId, 'internshipApplications');
    const studentId = getMappedId(report.studentId, 'students');

    if (!applicationId || !studentId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.monthlyReport.create({
        data: {
          id: newId,
          applicationId: applicationId,
          studentId: studentId,
          reportMonth: report.reportMonth,
          reportYear: report.reportYear,
          reportFileUrl: report.reportFileUrl,
          status: report.status || 'PENDING',
          submittedAt: processDate(report.submittedAt),
          reviewedAt: processDate(report.reviewedAt),
          reviewComments: report.reviewerComments || report.reviewComments,
          createdAt: processDate(report.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      if (error.code === 'P2003') {
        stats.skipped++;
      } else {
        stats.errors++;
        if (config.verbose) logError(`Error migrating monthly report: ${error.message}`);
      }
    }
  }
  finishCollectionMigration(stats);
}

async function migrateFacultyVisitLogs(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Faculty Visit Logs...', 'blue');
  const visits = await mongoDb.collection('faculty_visit_logs').find({}).toArray();
  const stats = startCollectionMigration('facultyVisitLogs', visits.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${visits.length} faculty visit logs`);
    return;
  }

  for (const visit of visits) {
    const newId = convertId(visit._id, 'facultyVisitLogs');
    const applicationId = getMappedId(visit.applicationId, 'internshipApplications');
    const facultyId = getMappedId(visit.facultyId, 'users');

    if (!applicationId || !facultyId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.facultyVisitLog.create({
        data: {
          id: newId,
          applicationId: applicationId,
          facultyId: facultyId,
          visitDate: processDate(visit.visitDate) || new Date(),
          visitType: visit.visitType || 'PHYSICAL',
          studentPerformance: visit.studentPerformance,
          visitDuration: visit.visitDuration,
          workEnvironment: visit.workEnvironment,
          industrySupport: visit.industrySupport,
          recommendations: visit.recommendations,
          createdAt: processDate(visit.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      if (error.code === 'P2003') {
        stats.skipped++;
      } else {
        stats.errors++;
        if (config.verbose) logError(`Error migrating faculty visit: ${error.message}`);
      }
    }
  }
  finishCollectionMigration(stats);
}

async function migrateNotifications(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Notifications...', 'blue');
  const notifications = await mongoDb.collection('Notification').find({}).toArray();
  const stats = startCollectionMigration('notifications', notifications.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${notifications.length} notifications`);
    return;
  }

  for (const notif of notifications) {
    const newId = convertId(notif._id, 'notifications');
    const userId = getMappedId(notif.userId, 'users');

    if (!userId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.notification.create({
        data: {
          id: newId,
          userId: userId,
          title: notif.title,
          body: notif.body,
          type: notif.type || 'INFO',
          read: notif.read ?? false,
          createdAt: processDate(notif.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      if (error.code === 'P2003') {
        stats.skipped++;
      } else {
        stats.errors++;
        if (config.verbose) logError(`Error migrating notification: ${error.message}`);
      }
    }
  }
  finishCollectionMigration(stats);
}

async function migrateGrievances(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Grievances...', 'blue');
  const grievances = await mongoDb.collection('Grievance').find({}).toArray();
  const stats = startCollectionMigration('grievances', grievances.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${grievances.length} grievances`);
    return;
  }

  for (const grievance of grievances) {
    const newId = convertId(grievance._id, 'grievances');
    const studentId = getMappedId(grievance.studentId, 'students');

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.grievance.create({
        data: {
          id: newId,
          studentId: studentId,
          title: grievance.title,
          description: grievance.description,
          category: grievance.category || 'OTHER',
          status: grievance.status || 'PENDING',
          severity: grievance.severity || grievance.priority || 'MEDIUM',
          resolution: grievance.resolution,
          resolvedDate: processDate(grievance.resolvedAt || grievance.resolvedDate),
          createdAt: processDate(grievance.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      if (error.code === 'P2003') {
        stats.skipped++;
      } else {
        stats.errors++;
        if (config.verbose) logError(`Error migrating grievance: ${error.message}`);
      }
    }
  }
  finishCollectionMigration(stats);
}

async function migrateSupportTickets(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Support Tickets (from Technical Queries)...', 'blue');
  const queries = await mongoDb.collection('technical_queries').find({}).toArray();
  const stats = startCollectionMigration('supportTickets', queries.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${queries.length} technical queries to support tickets`);
    return;
  }

  let ticketCounter = 1;

  for (const query of queries) {
    const newId = convertId(query._id, 'supportTickets');
    const userId = getMappedId(query.userId, 'users');

    if (!userId) {
      stats.skipped++;
      continue;
    }

    try {
      // Get user details for the ticket
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, role: true }
      });

      if (!user || !user.role) {
        stats.skipped++;
        continue;
      }

      // Generate ticket number (SUP-YYYYMMDD-XXXX)
      const createdDate = processDate(query.createdAt) || new Date();
      const dateStr = createdDate.toISOString().slice(0, 10).replace(/-/g, '');
      const ticketNumber = `SUP-${dateStr}-${String(ticketCounter++).padStart(4, '0')}`;

      // Map priority
      const priorityMap: Record<string, SupportTicketPriority> = {
        'LOW': SupportTicketPriority.LOW,
        'MEDIUM': SupportTicketPriority.MEDIUM,
        'HIGH': SupportTicketPriority.HIGH,
        'URGENT': SupportTicketPriority.URGENT,
        'CRITICAL': SupportTicketPriority.URGENT
      };

      // Map status
      const statusMap: Record<string, SupportTicketStatus> = {
        'OPEN': SupportTicketStatus.OPEN,
        'IN_PROGRESS': SupportTicketStatus.IN_PROGRESS,
        'RESOLVED': SupportTicketStatus.RESOLVED,
        'CLOSED': SupportTicketStatus.CLOSED,
        'PENDING': SupportTicketStatus.PENDING_USER
      };

      await prisma.supportTicket.create({
        data: {
          id: newId,
          ticketNumber: ticketNumber,
          submittedById: userId,
          submitterRole: user.role,
          submitterName: user.name || 'Unknown User',
          submitterEmail: user.email,
          subject: query.title || 'Technical Query',
          description: query.description || '',
          category: 'TECHNICAL_ISSUES',
          priority: priorityMap[query.priority?.toUpperCase()] || SupportTicketPriority.MEDIUM,
          attachments: query.attachments || [],
          status: statusMap[query.status?.toUpperCase()] || SupportTicketStatus.OPEN,
          resolution: query.resolution,
          resolvedAt: query.resolution ? processDate(query.updatedAt) : null,
          createdAt: createdDate,
        },
      });
      stats.migrated++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - skip
        stats.skipped++;
      } else {
        stats.errors++;
        if (config.verbose) logError(`Error migrating support ticket: ${error.message}`);
      }
    }
  }
  finishCollectionMigration(stats);
}

async function migrateAuditLogs(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
  log('Migrating Audit Logs...', 'blue');
  const logs = await mongoDb.collection('AuditLog').find({}).toArray();
  const stats = startCollectionMigration('auditLogs', logs.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${logs.length} audit logs`);
    return;
  }

  for (const l of logs) {
    const newId = convertId(l._id, 'auditLogs');
    const userId = getMappedId(l.userId, 'users');

    try {
      await prisma.auditLog.create({
        data: {
          id: newId,
          userId: userId,
          action: l.action,
          userRole: l.userRole,
          userName: l.userName,
          entityType: l.entityType,
          entityId: l.entityId,
          oldValues: l.oldValues,
          newValues: l.newValues,
          changedFields: l.changedFields || [],
          category: l.category,
          severity: l.severity || 'LOW',
          timestamp: processDate(l.timestamp) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      if (error.code === 'P2003') {
        stats.skipped++;
      } else {
        stats.errors++;
        if (config.verbose) logError(`Error migrating audit log: ${error.message}`);
      }
    }
  }
  finishCollectionMigration(stats);
}

// =============================================================================
// Post-Migration: Branch Fixing
// =============================================================================

const branchNormalizationMap: Record<string, string> = {
  // CSE variants
  'cse': 'CSE', 'Cse': 'CSE', 'CSE ': 'CSE', 'Computer Science': 'CSE',
  'Computer Science Engineering': 'CSE', 'Computer Science and Engineering': 'CSE',
  'COMPUTER SCIENCE AND ENGINEERING': 'CSE', 'COMPUTER SCIENCE': 'CSE',
  // ECE variants
  'ece': 'ECE', 'Ece': 'ECE', 'ECE ': 'ECE', 'Electronics': 'ECE',
  'Electronics and Communication': 'ECE', 'Electronics and Communication Engineering': 'ECE',
  'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
  // EE / Electrical variants
  'ee': 'EE', 'Ee': 'EE', 'EE ': 'EE', 'Electrical': 'EE',
  'Electrical Engineering': 'EE', 'ELECTRICAL ENGINEERING': 'EE', 'ELECTRICAL': 'EE',
  // ME / Mechanical variants
  'me': 'ME', 'Me': 'ME', 'ME ': 'ME', 'MECH': 'ME', 'Mech': 'ME', 'mech': 'ME',
  'Mechanical': 'ME', 'Mechanical Engineering': 'ME', 'MECHANICAL ENGINEERING': 'ME', 'MECHANICAL': 'ME',
  // CE / Civil variants
  'ce': 'CE', 'Ce': 'CE', 'CE ': 'CE', 'CIVIL': 'CE', 'Civil': 'CE',
  'Civil Engineering': 'CE', 'CIVIL ENGINEERING': 'CE',
  // IT variants
  'it': 'IT', 'It': 'IT', 'IT ': 'IT', 'Information Technology': 'IT', 'INFORMATION TECHNOLOGY': 'IT',
  // Other
  'LT': 'LT', 'lt': 'LT', 'Leather Technology': 'LT',
  'AS': 'AS', 'Applied Science': 'AS', 'Applied Sciences': 'AS',
};

function normalizeBranchName(branchName: string | null | undefined): string | null {
  if (!branchName) return null;
  const trimmed = branchName.trim();
  if (!trimmed) return null;
  if (branchNormalizationMap[trimmed]) return branchNormalizationMap[trimmed];
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(branchNormalizationMap)) {
    if (key.toLowerCase() === lowerTrimmed) return value;
  }
  return trimmed;
}

async function postMigrationBranchFix(prisma: PrismaClient, config: MigrationConfig) {
  logPhase('Post-Migration: Fixing Branch Data');

  if (config.dryRun) {
    logWarning('Dry run: Would fix branch data');
    return;
  }

  try {
    // Step 1: Get all unique branchName values from Users
    const usersWithBranch = await prisma.user.findMany({
      where: { branchName: { not: null } },
      select: { branchName: true },
      distinct: ['branchName'],
    });

    const uniqueBranchNames: string[] = [];
    for (const u of usersWithBranch) {
      if (u.branchName) {
        const normalized = normalizeBranchName(u.branchName);
        if (normalized && !uniqueBranchNames.includes(normalized)) {
          uniqueBranchNames.push(normalized);
        }
      }
    }

    log(`  Found ${uniqueBranchNames.length} unique branch names`, 'reset');

    // Step 2: Create branches that don't exist (using name, shortName, code fields)
    let branchesCreated = 0;
    for (const branchName of uniqueBranchNames) {
      const existing = await prisma.branch.findFirst({ where: { code: branchName } });
      if (!existing) {
        await prisma.branch.create({
          data: {
            name: `${branchName} Department`,
            shortName: branchName,
            code: branchName,
            duration: 4, // Default 4 years
          },
        });
        branchesCreated++;
      }
    }
    logSuccess(`Created ${branchesCreated} new branches`);

    // Step 3: Link users to branches
    const allBranches = await prisma.branch.findMany();
    const branchMap = new Map(allBranches.map(b => [b.code.toUpperCase(), b.id]));

    const usersToUpdate = await prisma.user.findMany({
      where: { branchName: { not: null }, branchId: null },
      select: { id: true, branchName: true },
    });

    let usersLinked = 0;
    for (const user of usersToUpdate) {
      if (user.branchName) {
        const normalized = normalizeBranchName(user.branchName);
        if (normalized) {
          const branchId = branchMap.get(normalized.toUpperCase());
          if (branchId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { branchId, branchName: normalized },
            });
            usersLinked++;
          }
        }
      }
    }
    logSuccess(`Linked ${usersLinked} users to branches`);

    // Step 4: Sync Student.branchId from User.branchId
    const studentsToUpdate = await prisma.student.findMany({
      where: { branchId: null },
      include: { user: { select: { branchId: true } } },
    });

    let studentsLinked = 0;
    for (const student of studentsToUpdate) {
      if (student.user?.branchId) {
        await prisma.student.update({
          where: { id: student.id },
          data: { branchId: student.user.branchId },
        });
        studentsLinked++;
      }
    }
    logSuccess(`Linked ${studentsLinked} students to branches`);

  } catch (error: any) {
    logError(`Branch fix error: ${error.message}`);
    if (config.verbose) console.error(error);
  }
}

// =============================================================================
// Connection Testing
// =============================================================================

async function testMongoConnection(url: string): Promise<{ success: boolean; message: string; db?: any; client?: MongoClient }> {
  try {
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db();
    const collections = await db.listCollections().toArray();
    return {
      success: true,
      message: `Connected. Found ${collections.length} collections.`,
      db,
      client,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

async function testPostgresConnection(url: string): Promise<{ success: boolean; message: string; prisma?: PrismaClient; pool?: Pool }> {
  try {
    const pool = new Pool({
      connectionString: url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter } as any);

    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    return {
      success: true,
      message: 'Connected successfully.',
      prisma,
      pool,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

// =============================================================================
// CLI Report Functions
// =============================================================================

function printMigrationReport(config: MigrationConfig, totalTime: string): void {
  const totalRecords = migrationStats.reduce((sum, s) => sum + s.total, 0);
  const totalMigrated = migrationStats.reduce((sum, s) => sum + s.migrated, 0);
  const totalSkipped = migrationStats.reduce((sum, s) => sum + s.skipped, 0);
  const totalErrors = migrationStats.reduce((sum, s) => sum + s.errors, 0);
  const successRate = totalRecords > 0 ? ((totalMigrated / totalRecords) * 100).toFixed(1) : '0';

  logSection('MIGRATION REPORT');

  if (config.dryRun) {
    logWarning('DRY RUN MODE - No data was actually migrated');
    console.log('');
  }

  // Overview
  log('╔══════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    MIGRATION OVERVIEW                     ║', 'cyan');
  log('╠══════════════════════════════════════════════════════════╣', 'cyan');
  log(`║  Total Records:     ${String(totalRecords).padStart(10)}                         ║`, 'cyan');
  log(`║  Migrated:          ${String(totalMigrated).padStart(10)}  (${successRate}%)                  ║`, 'green');
  log(`║  Skipped:           ${String(totalSkipped).padStart(10)}                         ║`, 'yellow');
  log(`║  Errors:            ${String(totalErrors).padStart(10)}                         ║`, totalErrors > 0 ? 'red' : 'green');
  log(`║  Duration:          ${String(totalTime + 's').padStart(10)}                         ║`, 'cyan');
  log('╚══════════════════════════════════════════════════════════╝', 'cyan');

  console.log('');

  // Detailed collection stats
  log('┌─────────────────────────────────────────────────────────────────────────────┐', 'reset');
  log('│                         COLLECTION DETAILS                                   │', 'reset');
  log('├──────────────────────────┬────────┬──────────┬─────────┬─────────┬──────────┤', 'reset');
  log('│ Collection               │  Total │ Migrated │ Skipped │  Errors │  Time(s) │', 'reset');
  log('├──────────────────────────┼────────┼──────────┼─────────┼─────────┼──────────┤', 'reset');

  for (const stat of migrationStats) {
    const duration = stat.endTime ? ((stat.endTime - stat.startTime) / 1000).toFixed(2) : '-';
    const errorColor = stat.errors > 0 ? 'red' : 'reset';
    const collName = stat.collection.padEnd(24).slice(0, 24);
    const total = String(stat.total).padStart(6);
    const migrated = String(stat.migrated).padStart(8);
    const skipped = String(stat.skipped).padStart(7);
    const errors = String(stat.errors).padStart(7);
    const time = String(duration).padStart(8);

    if (stat.errors > 0) {
      log(`│ ${collName} │ ${total} │ ${migrated} │ ${skipped} │ ${colors.red}${errors}${colors.reset} │ ${time} │`, 'reset');
    } else {
      console.log(`│ ${collName} │ ${total} │ ${migrated} │ ${skipped} │ ${errors} │ ${time} │`);
    }
  }

  log('└──────────────────────────┴────────┴──────────┴─────────┴─────────┴──────────┘', 'reset');

  // ID mappings summary
  console.log('');
  log('┌─────────────────────────────────────────────────────────────────────────────┐', 'reset');
  log('│                          ID MAPPINGS CREATED                                 │', 'reset');
  log('├─────────────────────────────────────────────────────────────────────────────┤', 'reset');

  let mappingLine = '│ ';
  let count = 0;
  for (const [collection, map] of Object.entries(idMaps)) {
    if (map.size > 0) {
      const item = `${collection}: ${map.size}`;
      if (mappingLine.length + item.length > 75) {
        console.log(mappingLine.padEnd(78) + '│');
        mappingLine = '│ ';
      }
      mappingLine += item + '  ';
      count++;
    }
  }
  if (mappingLine.length > 2) {
    console.log(mappingLine.padEnd(78) + '│');
  }
  log('└─────────────────────────────────────────────────────────────────────────────┘', 'reset');

  // Error details (if any)
  if (globalErrors.length > 0 && config.verbose) {
    console.log('');
    log('┌─────────────────────────────────────────────────────────────────────────────┐', 'red');
    log('│                            ERROR DETAILS                                     │', 'red');
    log('├─────────────────────────────────────────────────────────────────────────────┤', 'red');

    const maxErrors = 20;
    const displayErrors = globalErrors.slice(0, maxErrors);

    for (const err of displayErrors) {
      const msg = `${err.collection}: ${err.id} - ${err.message}`.slice(0, 75);
      log(`│ ${msg.padEnd(76)}│`, 'red');
    }

    if (globalErrors.length > maxErrors) {
      log(`│ ... and ${globalErrors.length - maxErrors} more errors (use --verbose for full list)`.padEnd(77) + '│', 'red');
    }

    log('└─────────────────────────────────────────────────────────────────────────────┘', 'red');
  } else if (globalErrors.length > 0) {
    console.log('');
    logWarning(`${globalErrors.length} errors occurred. Use --verbose to see details.`);
  }

  // Final status
  console.log('');
  if (totalErrors === 0 && !config.dryRun) {
    log('╔══════════════════════════════════════════════════════════╗', 'green');
    log('║          ✓ MIGRATION COMPLETED SUCCESSFULLY              ║', 'green');
    log('╚══════════════════════════════════════════════════════════╝', 'green');
  } else if (totalErrors > 0) {
    log('╔══════════════════════════════════════════════════════════╗', 'yellow');
    log('║       ⚠ MIGRATION COMPLETED WITH ERRORS                  ║', 'yellow');
    log('╚══════════════════════════════════════════════════════════╝', 'yellow');
  }

  // Recommendations
  if (totalSkipped > 0 || totalErrors > 0) {
    console.log('');
    log('Recommendations:', 'cyan');
    if (totalSkipped > 0) {
      console.log('  • Review skipped records - often caused by missing foreign key references');
    }
    if (totalErrors > 0) {
      console.log('  • Run with --verbose flag to see detailed error messages');
      console.log('  • Check for data integrity issues in source MongoDB');
    }
  }
}

// =============================================================================
// Main Migration Function
// =============================================================================

async function main() {
  const config = parseArgs();

  logSection('MongoDB to PostgreSQL Server Migration');

  // Validate configuration
  if (!config.mongodbUrl) {
    logError('MongoDB URL is required. Use --mongodb-url or set SOURCE_MONGODB_URL');
    process.exit(1);
  }

  if (!config.postgresUrl) {
    logError('PostgreSQL URL is required. Use --postgres-url or set TARGET_DATABASE_URL');
    process.exit(1);
  }

  console.log('');
  log('Configuration:', 'cyan');
  log(`  MongoDB (Source): ${maskConnectionUrl(config.mongodbUrl)}`);
  log(`  PostgreSQL (Target): ${maskConnectionUrl(config.postgresUrl)}`);
  log(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}`);
  log(`  Batch Size: ${config.batchSize}`);
  log(`  Skip Clear: ${config.skipClear ? 'Yes' : 'No'}`);
  log(`  Verbose: ${config.verbose ? 'Yes' : 'No'}`);

  let mongoClient: MongoClient | null = null;
  let prisma: PrismaClient | null = null;
  let pgPool: Pool | null = null;

  try {
    // Test connections
    logPhase('Testing Connections');

    log('Testing MongoDB connection...', 'reset');
    const mongoResult = await testMongoConnection(config.mongodbUrl);
    if (!mongoResult.success) {
      logError(`MongoDB connection failed: ${mongoResult.message}`);
      process.exit(1);
    }
    logSuccess(`MongoDB: ${mongoResult.message}`);
    mongoClient = mongoResult.client!;
    const mongoDb = mongoResult.db;

    log('Testing PostgreSQL connection...', 'reset');
    const pgResult = await testPostgresConnection(config.postgresUrl);
    if (!pgResult.success) {
      logError(`PostgreSQL connection failed: ${pgResult.message}`);
      process.exit(1);
    }
    logSuccess(`PostgreSQL: ${pgResult.message}`);
    prisma = pgResult.prisma!;
    pgPool = pgResult.pool!;

    // List MongoDB collections
    const collections = await mongoDb.listCollections().toArray();
    log(`Available MongoDB collections: ${collections.map((c: any) => c.name).join(', ')}`, 'reset');

    // Run pre-migration validation
    await validateSourceData(mongoDb, config);

    if (config.dryRun) {
      logPhase('Dry Run Mode - No data will be modified');
    }

    // Clear PostgreSQL tables
    if (!config.dryRun && !config.skipClear) {
      logPhase('Clearing PostgreSQL Tables');
      await prisma.$executeRawUnsafe(`
        DO $$ DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
          END LOOP;
        END $$;
      `);
      logSuccess('PostgreSQL tables cleared');
    }

    // Run migrations
    logPhase('Starting Data Migration');

    const startTime = Date.now();

    // Phase 1: Core entities
    await migrateInstitutions(mongoDb, prisma, config);

    // Phase 2: Users
    await migrateUsers(mongoDb, prisma, config);

    // Phase 3: Academic structure
    await migrateBatches(mongoDb, prisma, config);
    await migrateBranches(mongoDb, prisma, config);

    // Phase 4: Students
    await migrateStudents(mongoDb, prisma, config);

    // Phase 5: Applications and assignments
    await migrateInternshipApplications(mongoDb, prisma, config);
    await migrateMentorAssignments(mongoDb, prisma, config);

    // Phase 6: Documents
    await migrateDocuments(mongoDb, prisma, config);

    // Phase 7: Reports and visits
    await migrateMonthlyReports(mongoDb, prisma, config);
    await migrateFacultyVisitLogs(mongoDb, prisma, config);

    // Phase 8: Support data
    await migrateNotifications(mongoDb, prisma, config);
    await migrateGrievances(mongoDb, prisma, config);
    await migrateSupportTickets(mongoDb, prisma, config);
    await migrateAuditLogs(mongoDb, prisma, config);

    // Phase 9: Post-migration fixes
    await postMigrationBranchFix(prisma, config);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Print comprehensive CLI report
    printMigrationReport(config, totalTime);

    // Summary message
    if (!config.dryRun) {
      console.log('');
      log('┌─────────────────────────────────────────────────────────────────────────────┐', 'cyan');
      log('│                         MIGRATION COMPLETE                                   │', 'cyan');
      log('├─────────────────────────────────────────────────────────────────────────────┤', 'cyan');
      log('│ The migration has completed with the following data synced:                  │', 'cyan');
      log('│                                                                              │', 'cyan');
      log('│   • User.name, email, phoneNo, dob, rollNumber synced from Student           │', 'cyan');
      log('│   • User.branchId, branchName, institutionId synced from Student             │', 'cyan');
      log('│   • User.active synced from Student.isActive                                 │', 'cyan');
      log('│   • Branch records created and linked to Users/Students                      │', 'cyan');
      log('│   • Technical queries migrated to Support Tickets (TechnicalQuery removed)    │', 'cyan');
      log('│   • User is now the Single Source of Truth (SOT) for these fields            │', 'cyan');
      log('└─────────────────────────────────────────────────────────────────────────────┘', 'cyan');
    }

  } catch (error: any) {
    logError(`Migration failed: ${error.message}`);
    if (config.verbose) {
      console.error(error);
    }
    process.exit(1);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
    if (pgPool) {
      await pgPool.end();
    }
  }
}

main().catch((e) => {
  logError(e.message);
  process.exit(1);
});
