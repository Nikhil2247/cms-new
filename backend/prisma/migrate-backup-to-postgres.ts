/**
 * MongoDB Backup to PostgreSQL Migration Script
 *
 * This script directly reads from a MongoDB backup .gz file and migrates
 * all data to PostgreSQL without requiring a running MongoDB instance.
 *
 * Usage:
 *   npx ts-node prisma/migrate-backup-to-postgres.ts --backup "D:\path\to\backup.gz"
 *
 * Options:
 *   --backup, -b     Path to MongoDB backup .gz file (required)
 *   --dry-run, -d    Test without writing to database
 *   --verbose, -v    Show detailed logs
 *   --skip-clear     Don't clear PostgreSQL tables before migration
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// =============================================================================
// Configuration
// =============================================================================

interface MigrationConfig {
  backupPath: string;
  dryRun: boolean;
  verbose: boolean;
  skipClear: boolean;
  extractPath: string;
}

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    backupPath: '',
    dryRun: false,
    verbose: false,
    skipClear: false,
    extractPath: path.join(process.cwd(), 'temp_mongo_extract'),
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--backup':
      case '-b':
        config.backupPath = args[++i];
        break;
      case '--dry-run':
      case '-d':
        config.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--skip-clear':
      case '-s':
        config.skipClear = true;
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
MongoDB Backup to PostgreSQL Migration Script

USAGE:
  npx ts-node prisma/migrate-backup-to-postgres.ts --backup <path>

OPTIONS:
  -b, --backup <path>   Path to MongoDB backup .gz file (required)
  -d, --dry-run         Test without writing to database
  -v, --verbose         Show detailed logs
  -s, --skip-clear      Don't clear PostgreSQL tables before migration
  -h, --help            Show this help message

EXAMPLES:
  npx ts-node prisma/migrate-backup-to-postgres.ts --backup "D:\\backup.gz"
  npx ts-node prisma/migrate-backup-to-postgres.ts -b backup.gz --dry-run
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
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string): void {
  console.log('');
  log('═'.repeat(70), 'cyan');
  log(`  ${title}`, 'cyan');
  log('═'.repeat(70), 'cyan');
}

function logPhase(phase: string): void {
  console.log('');
  log(`▶ ${phase}`, 'blue');
  log('─'.repeat(50), 'blue');
}

function logSuccess(message: string): void {
  log(`  ✓ ${message}`, 'green');
}

function logWarning(message: string): void {
  log(`  ⚠ ${message}`, 'yellow');
}

function logError(message: string): void {
  log(`  ✗ ${message}`, 'red');
}

function logInfo(message: string): void {
  log(`  ℹ ${message}`, 'cyan');
}

// =============================================================================
// ID Mapping (MongoDB ObjectId -> PostgreSQL UUID)
// =============================================================================

const idMaps: Record<string, Map<string, string>> = {
  users: new Map(),
  institutions: new Map(),
  students: new Map(),
  branches: new Map(),
  departments: new Map(),
  batches: new Map(),
  semesters: new Map(),
  subjects: new Map(),
  industries: new Map(),
  internships: new Map(),
  internshipApplications: new Map(),
  mentorAssignments: new Map(),
  documents: new Map(),
  fees: new Map(),
  feeStructures: new Map(),
  examResults: new Map(),
  notifications: new Map(),
  notificationSettings: new Map(),
  auditLogs: new Map(),
  grievances: new Map(),
  technicalQueries: new Map(),
  monthlyReports: new Map(),
  facultyVisitLogs: new Map(),
  monthlyFeedbacks: new Map(),
  completionFeedbacks: new Map(),
  complianceRecords: new Map(),
  industryRequests: new Map(),
  referralApplications: new Map(),
  approvedReferrals: new Map(),
  scholarships: new Map(),
  placements: new Map(),
  calendars: new Map(),
  notices: new Map(),
  internshipPreferences: new Map(),
  institutionSettings: new Map(),
  blacklistedTokens: new Map(),
  stateReports: new Map(),
  feeReports: new Map(),
  reportTemplates: new Map(),
  generatedReports: new Map(),
};

function convertId(objectId: any, collection: string): string {
  if (!objectId) return uuidv4();

  // Handle different ObjectId formats
  let idStr: string;
  if (typeof objectId === 'string') {
    idStr = objectId;
  } else if (objectId.$oid) {
    idStr = objectId.$oid;
  } else if (objectId.toString) {
    idStr = objectId.toString();
  } else {
    return uuidv4();
  }

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

function getMappedId(objectId: any, collection: string): string | null {
  if (!objectId) return null;

  let idStr: string;
  if (typeof objectId === 'string') {
    idStr = objectId;
  } else if (objectId.$oid) {
    idStr = objectId.$oid;
  } else if (objectId.toString) {
    idStr = objectId.toString();
  } else {
    return null;
  }

  const map = idMaps[collection];
  return map?.get(idStr) || null;
}

// =============================================================================
// Data Type Helpers
// =============================================================================

function processDate(value: any): Date | null {
  if (!value) return null;

  // Handle MongoDB date format
  if (value.$date) {
    if (typeof value.$date === 'string') {
      return new Date(value.$date);
    }
    if (value.$date.$numberLong) {
      return new Date(parseInt(value.$date.$numberLong));
    }
  }

  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function processNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (value.$numberInt) return parseInt(value.$numberInt);
  if (value.$numberLong) return parseInt(value.$numberLong);
  if (value.$numberDouble) return parseFloat(value.$numberDouble);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  return null;
}

function processBoolean(value: any, defaultValue: boolean = false): boolean {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1) return true;
  if (value === 'false' || value === 0) return false;
  return defaultValue;
}

function processArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v));
  return [];
}

function processJson(value: any): any {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// =============================================================================
// BSON Reading Utilities
// =============================================================================

let BSON: any;

async function loadBSON(): Promise<void> {
  try {
    BSON = await import('bson');
    logSuccess('BSON library loaded');
  } catch (error) {
    logError('Failed to load BSON library. Installing...');
    execSync('npm install bson', { stdio: 'inherit' });
    BSON = await import('bson');
    logSuccess('BSON library installed and loaded');
  }
}

function readBsonFile(filePath: string): any[] {
  const documents: any[] = [];
  const buffer = fs.readFileSync(filePath);
  let offset = 0;

  while (offset < buffer.length) {
    // Read document size (first 4 bytes)
    const size = buffer.readInt32LE(offset);
    if (size <= 0 || offset + size > buffer.length) break;

    // Extract document buffer
    const docBuffer = buffer.slice(offset, offset + size);
    try {
      const doc = BSON.deserialize(docBuffer);
      documents.push(doc);
    } catch (e) {
      // Skip invalid documents
    }
    offset += size;
  }

  return documents;
}

function readJsonFile(filePath: string): any[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Handle JSONL format (one JSON per line) or JSON array
    if (content.trim().startsWith('[')) {
      return JSON.parse(content);
    }
    // JSONL format
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch (e) {
    return [];
  }
}

// =============================================================================
// MongoDB Archive Parser
// =============================================================================

// Store parsed collections data in memory
const parsedCollections: Map<string, any[]> = new Map();

/**
 * Parse MongoDB archive format (mongodump --archive)
 * The archive format consists of:
 * 1. Magic header
 * 2. Prelude documents (metadata)
 * 3. Interleaved BSON documents with namespace markers
 */
function parseMongoArchive(buffer: Buffer): Map<string, any[]> {
  const collections = new Map<string, any[]>();
  let offset = 0;

  // Helper to read a 32-bit little-endian integer
  const readInt32 = (off: number): number => {
    if (off + 4 > buffer.length) return -1;
    return buffer.readInt32LE(off);
  };

  // Helper to read a null-terminated string
  const readCString = (off: number): { str: string; nextOffset: number } => {
    let end = off;
    while (end < buffer.length && buffer[end] !== 0) end++;
    const str = buffer.slice(off, end).toString('utf-8');
    return { str, nextOffset: end + 1 };
  };

  // Skip initial bytes that might be header/magic
  // MongoDB archive has a specific format - try to find BSON documents

  while (offset < buffer.length - 4) {
    const docSize = readInt32(offset);

    // Valid BSON document size check
    if (docSize < 5 || docSize > 16 * 1024 * 1024 || offset + docSize > buffer.length) {
      offset++;
      continue;
    }

    // Check if this looks like a valid BSON document (ends with 0x00)
    if (buffer[offset + docSize - 1] !== 0) {
      offset++;
      continue;
    }

    try {
      const docBuffer = buffer.slice(offset, offset + docSize);
      const doc = BSON.deserialize(docBuffer, { promoteBuffers: true });

      // Check if this is a metadata/header document
      if (doc.db && doc.collection) {
        // This is archive metadata
        offset += docSize;
        continue;
      }

      // Try to identify the collection from the document structure
      let collectionName = identifyCollection(doc);

      if (collectionName && doc._id) {
        if (!collections.has(collectionName)) {
          collections.set(collectionName, []);
        }
        collections.get(collectionName)!.push(doc);
      } else if (doc._id) {
        // Track unidentified documents for debugging
        if (!collections.has('_unidentified')) {
          collections.set('_unidentified', []);
        }
        collections.get('_unidentified')!.push(doc);
      }

      offset += docSize;
    } catch (e) {
      offset++;
    }
  }

  // Log sample of unidentified documents for debugging
  const unidentified = collections.get('_unidentified') || [];
  if (unidentified.length > 0) {
    logWarning(`Found ${unidentified.length} unidentified documents`);
    // Group by unique key patterns and keep samples
    const patterns = new Map<string, { count: number; sample: any }>();
    for (const doc of unidentified) {
      const keys = Object.keys(doc).filter(k => k !== '_id' && k !== '__v').sort().join(',');
      if (!patterns.has(keys)) {
        patterns.set(keys, { count: 0, sample: doc });
      }
      patterns.get(keys)!.count++;
    }
    logInfo('Unidentified document patterns (with sample keys):');
    for (const [pattern, data] of Array.from(patterns.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 15)) {
      logInfo(`  ${data.count}x: ${pattern.substring(0, 120)}${pattern.length > 120 ? '...' : ''}`);
      // Show sample document keys for large groups
      if (data.count >= 5) {
        const sampleKeys = Object.keys(data.sample).filter(k => k !== '_id' && k !== '__v');
        logInfo(`      Sample keys: ${sampleKeys.join(', ')}`);
      }
    }
    collections.delete('_unidentified');
  }

  return collections;
}

/**
 * Identify collection name based on document structure
 */
function identifyCollection(doc: any): string | null {
  // BlacklistedToken collection - check first as it has specific fields
  if (doc.token !== undefined && doc.expiresAt !== undefined && doc.isFullInvalidation !== undefined) {
    return 'blacklistedTokens';
  }

  // GeneratedReport collection
  if (doc.reportType !== undefined && doc.fileUrl !== undefined && doc.generatedBy !== undefined && doc.configuration !== undefined) {
    return 'generatedReports';
  }

  // Skip internal MongoDB user documents
  if (doc.credentials !== undefined && doc.db !== undefined && doc.roles !== undefined) {
    return null; // Skip MongoDB internal users
  }

  // User collection - more flexible detection
  if (doc.password !== undefined && doc.role !== undefined) {
    return 'users';
  }

  // Student collection - more flexible detection (check before batch!)
  // Students have userId and student-specific fields like rollNumber, admissionNumber, parentName, currentSemester, etc.
  if (doc.userId && (
    doc.rollNumber !== undefined ||
    doc.admissionNumber !== undefined ||
    doc.parentName !== undefined ||
    doc.parentContact !== undefined ||
    doc.currentSemester !== undefined ||
    doc.tenthper !== undefined ||
    doc.twelthper !== undefined ||
    doc.diplomaPercentage !== undefined ||
    doc.totalBacklogs !== undefined ||
    doc.clearanceStatus !== undefined ||
    (doc.branchId !== undefined && doc.name !== undefined)
  )) {
    return 'students';
  }

  // Institution collection - more flexible detection
  if ((doc.code !== undefined || doc.contactEmail !== undefined) &&
      (doc.affiliatedTo !== undefined || doc.autonomousStatus !== undefined || doc.totalStudentSeats !== undefined)) {
    return 'institutions';
  }

  // Branch collection
  if (doc.shortName !== undefined && doc.duration !== undefined && doc.code !== undefined && !doc.registrationNumber) {
    return 'branches';
  }

  // Department collection
  if (doc.hodId !== undefined && doc.shortName !== undefined) {
    return 'departments';
  }

  // Batch collection - simple structure with name and isActive, no student-specific fields
  if (doc.name && doc.isActive !== undefined &&
      !doc.title && !doc.description && !doc.password && !doc.shortName &&
      !doc.userId && !doc.rollNumber && !doc.parentName && !doc.currentSemester &&
      !doc.email && !doc.role && !doc.companyName && !doc.contactEmail) {
    return 'batches';
  }

  // Semester collection
  if (doc.number !== undefined && doc.isActive !== undefined && !doc.name && !doc.subjectName) {
    return 'semesters';
  }

  // Subject collection
  if (doc.subjectName !== undefined && doc.subjectCode !== undefined && doc.syllabusYear !== undefined) {
    return 'subjects';
  }

  // Scholarship collection
  if (doc.type !== undefined && doc.amount !== undefined && doc.status !== undefined && !doc.companyName) {
    return 'scholarships';
  }

  // FeeStructure collection
  if (doc.admissionType !== undefined && doc.scholarshipScheme !== undefined && doc.semesterNumber !== undefined) {
    return 'feeStructures';
  }

  // Industry collection
  if (doc.companyName !== undefined && doc.registrationNumber !== undefined && doc.panNumber !== undefined) {
    return 'industries';
  }

  // Internship collection
  if (doc.title !== undefined && doc.industryId !== undefined && doc.numberOfPositions !== undefined) {
    return 'internships';
  }

  // InternshipApplication collection
  if (doc.studentId !== undefined && doc.status !== undefined && (doc.isSelfIdentified !== undefined || doc.applicationDate !== undefined)) {
    return 'internshipApplications';
  }

  // MentorAssignment collection
  if (doc.studentId !== undefined && doc.mentorId !== undefined && doc.assignedBy !== undefined) {
    return 'mentorAssignments';
  }

  // Document collection
  if (doc.studentId !== undefined && doc.type !== undefined && doc.fileName !== undefined && doc.fileUrl !== undefined) {
    return 'documents';
  }

  // Fee collection
  if (doc.studentId !== undefined && doc.semesterId !== undefined && doc.amountDue !== undefined) {
    return 'fees';
  }

  // ExamResult collection
  if (doc.studentId !== undefined && doc.semesterId !== undefined && doc.subjectId !== undefined && doc.marks !== undefined) {
    return 'examResults';
  }

  // Notification collection
  if (doc.userId !== undefined && doc.title !== undefined && doc.body !== undefined && doc.read !== undefined) {
    return 'notifications';
  }

  // MonthlyFeedback collection
  if (doc.applicationId !== undefined && doc.feedbackMonth !== undefined) {
    return 'monthlyFeedbacks';
  }

  // MonthlyReport collection
  if (doc.applicationId !== undefined && doc.reportMonth !== undefined && doc.reportYear !== undefined) {
    return 'monthlyReports';
  }

  // FacultyVisitLog collection
  if (doc.applicationId !== undefined && doc.visitNumber !== undefined) {
    return 'facultyVisitLogs';
  }

  // CompletionFeedback collection
  if (doc.applicationId !== undefined && (doc.studentFeedback !== undefined || doc.industryFeedback !== undefined)) {
    return 'completionFeedbacks';
  }

  // Grievance collection
  if (doc.studentId !== undefined && doc.category !== undefined && doc.description !== undefined && doc.severity !== undefined) {
    return 'grievances';
  }

  // AuditLog collection
  if (doc.action !== undefined && doc.entityType !== undefined && doc.userRole !== undefined) {
    return 'auditLogs';
  }

  // Calendar collection
  if (doc.title !== undefined && doc.startDate !== undefined && !doc.numberOfPositions && !doc.body) {
    return 'calendars';
  }

  // Notice collection
  if (doc.title !== undefined && doc.message !== undefined && !doc.body) {
    return 'notices';
  }

  // Placement collection
  if (doc.studentId !== undefined && doc.companyName !== undefined && doc.jobRole !== undefined) {
    return 'placements';
  }

  // InternshipPreference collection
  if (doc.studentId !== undefined && doc.preferredFields !== undefined) {
    return 'internshipPreferences';
  }

  // ComplianceRecord collection
  if (doc.studentId !== undefined && doc.complianceType !== undefined) {
    return 'complianceRecords';
  }

  // TechnicalQuery collection
  if (doc.userId !== undefined && doc.title !== undefined && doc.status !== undefined && doc.priority !== undefined && !doc.body) {
    return 'technicalQueries';
  }

  // IndustryRequest collection
  if (doc.requestType !== undefined && doc.priority !== undefined && doc.title !== undefined && doc.industryId !== undefined) {
    return 'industryRequests';
  }

  return null;
}

// =============================================================================
// Backup Extraction
// =============================================================================

async function extractBackup(config: MigrationConfig): Promise<string> {
  logPhase('Extracting MongoDB Backup');

  if (!fs.existsSync(config.backupPath)) {
    throw new Error(`Backup file not found: ${config.backupPath}`);
  }

  // Create extraction directory
  if (fs.existsSync(config.extractPath)) {
    fs.rmSync(config.extractPath, { recursive: true });
  }
  fs.mkdirSync(config.extractPath, { recursive: true });

  const backupPath = config.backupPath;

  try {
    logInfo('Reading and decompressing backup...');

    // Read and decompress the .gz file
    const compressedData = fs.readFileSync(backupPath);
    const decompressedData = zlib.gunzipSync(compressedData);

    logSuccess(`Decompressed backup file (${(decompressedData.length / 1024 / 1024).toFixed(2)} MB)`);

    // Parse the MongoDB archive format
    logInfo('Parsing MongoDB archive format...');
    const collections = parseMongoArchive(decompressedData);

    // Store in global map for later use
    for (const [name, docs] of collections) {
      parsedCollections.set(name, docs);
    }

    logSuccess(`Parsed ${collections.size} collections`);
    for (const [name, docs] of collections) {
      logInfo(`  - ${name}: ${docs.length} documents`);
    }

    return config.extractPath;
  } catch (error: any) {
    logError(`Extraction failed: ${error.message}`);
    throw error;
  }
}

async function findCollections(extractPath: string): Promise<Map<string, string>> {
  // Return a map of collection names to a placeholder path
  // The actual data is in parsedCollections
  const collections = new Map<string, string>();

  for (const name of parsedCollections.keys()) {
    collections.set(name, `memory://${name}`);
  }

  return collections;
}

async function loadCollectionData(filePath: string): Promise<any[]> {
  // Check if it's from our in-memory parsed data
  if (filePath.startsWith('memory://')) {
    const collectionName = filePath.replace('memory://', '');
    return parsedCollections.get(collectionName) || [];
  }

  // Fallback to file-based loading
  if (filePath.endsWith('.bson')) {
    return readBsonFile(filePath);
  } else if (filePath.endsWith('.json')) {
    return readJsonFile(filePath);
  }
  return [];
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
}

const allStats: MigrationStats[] = [];

function startCollectionMigration(collection: string, total: number): MigrationStats {
  const stats: MigrationStats = {
    collection,
    total,
    migrated: 0,
    skipped: 0,
    errors: 0,
    startTime: Date.now(),
  };
  allStats.push(stats);
  return stats;
}

function finishCollectionMigration(stats: MigrationStats): void {
  stats.endTime = Date.now();
  const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
  const successRate = stats.total > 0 ? ((stats.migrated / stats.total) * 100).toFixed(1) : '0';
  log(`    Migrated: ${stats.migrated}/${stats.total} (${successRate}%) | Skipped: ${stats.skipped} | Errors: ${stats.errors} | Time: ${duration}s`, 'reset');
}

// =============================================================================
// Collection Migration Functions
// =============================================================================

async function migrateInstitutions(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Institutions...');
  const stats = startCollectionMigration('institutions', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} institutions`);
    return;
  }

  for (const inst of data) {
    const newId = convertId(inst._id, 'institutions');
    try {
      await prisma.institution.create({
        data: {
          id: newId,
          code: inst.code || `INST${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
          name: inst.name,
          shortName: inst.shortName,
          type: inst.type || 'POLYTECHNIC',
          address: inst.address,
          city: inst.city,
          state: inst.state || 'Punjab',
          district: inst.district,
          pinCode: inst.pinCode,
          country: inst.country || 'India',
          contactEmail: inst.contactEmail,
          contactPhone: inst.contactPhone,
          alternatePhone: inst.alternatePhone,
          website: inst.website,
          establishedYear: processNumber(inst.establishedYear),
          affiliatedTo: inst.affiliatedTo,
          recognizedBy: inst.recognizedBy,
          naacGrade: inst.naacGrade,
          autonomousStatus: processBoolean(inst.autonomousStatus),
          totalStudentSeats: processNumber(inst.totalStudentSeats),
          totalStaffSeats: processNumber(inst.totalStaffSeats),
          isActive: processBoolean(inst.isActive, true),
          createdAt: processDate(inst.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating institution ${inst.name}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateUsers(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Users...');
  const stats = startCollectionMigration('users', data.length);
  const processedEmails = new Set<string>();

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} users`);
    return;
  }

  for (const user of data) {
    const newId = convertId(user._id, 'users');
    const institutionId = getMappedId(user.institutionId, 'institutions');
    const email = user.email?.toLowerCase();
    const isDuplicate = email && processedEmails.has(email);

    if (email && !isDuplicate) {
      processedEmails.add(email);
    }

    const finalEmail = isDuplicate
      ? `duplicate_${newId}@removed.local`
      : user.email;

    try {
      await prisma.user.create({
        data: {
          id: newId,
          email: finalEmail,
          password: user.password || 'default_password_hash',
          name: user.name || 'Unknown',
          role: user.role,
          active: isDuplicate ? false : processBoolean(user.active, true),
          institutionId: institutionId,
          designation: user.designation,
          phoneNo: user.phoneNo,
          rollNumber: user.rollNumber,
          branchName: user.branchName,
          dob: user.dob,
          resetPasswordToken: user.resetPasswordToken,
          resetPasswordExpiry: processDate(user.resetPasswordExpiry),
          consent: processBoolean(user.consent),
          consentAt: processDate(user.consentAt),
          lastLoginAt: processDate(user.lastLoginAt),
          lastLoginIp: user.lastLoginIp,
          loginCount: processNumber(user.loginCount) || 0,
          previousLoginAt: processDate(user.previousLoginAt),
          hasChangedDefaultPassword: processBoolean(user.hasChangedDefaultPassword),
          passwordChangedAt: processDate(user.passwordChangedAt),
          createdAt: processDate(user.createdAt) || new Date(),
        },
      });
      stats.migrated++;
      if (isDuplicate) stats.skipped++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating user ${user.email}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateBranches(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Branches...');
  const stats = startCollectionMigration('branches', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} branches`);
    return;
  }

  for (const branch of data) {
    const newId = convertId(branch._id, 'branches');
    const institutionId = getMappedId(branch.institutionId, 'institutions');

    try {
      await prisma.branch.create({
        data: {
          id: newId,
          name: branch.name,
          shortName: branch.shortName || branch.name?.substring(0, 10) || 'BR',
          code: branch.code || `${branch.shortName || 'BR'}-${Date.now()}`,
          duration: processNumber(branch.duration) || 3,
          isActive: processBoolean(branch.isActive, true),
          institutionId: institutionId,
          createdAt: processDate(branch.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating branch ${branch.name}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateDepartments(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Departments...');
  const stats = startCollectionMigration('departments', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} departments`);
    return;
  }

  for (const dept of data) {
    const newId = convertId(dept._id, 'departments');
    const institutionId = getMappedId(dept.institutionId, 'institutions');

    try {
      await prisma.department.create({
        data: {
          id: newId,
          name: dept.name,
          shortName: dept.shortName,
          code: dept.code || `DEPT-${Date.now()}`,
          hodId: dept.hodId,
          isActive: processBoolean(dept.isActive, true),
          institutionId: institutionId,
          createdAt: processDate(dept.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating department ${dept.name}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateBatches(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Batches...');
  const stats = startCollectionMigration('batches', data.length);
  const processedNames = new Set<string>();

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} batches`);
    return;
  }

  for (const batch of data) {
    const newId = convertId(batch._id, 'batches');
    const institutionId = getMappedId(batch.institutionId, 'institutions');

    let batchName = batch.name;
    if (processedNames.has(batchName)) {
      batchName = `${batch.name}-${newId.substring(0, 8)}`;
    }
    processedNames.add(batchName);

    try {
      await prisma.batch.create({
        data: {
          id: newId,
          name: batchName,
          isActive: processBoolean(batch.isActive, true),
          institutionId: institutionId,
          createdAt: processDate(batch.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating batch ${batch.name}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateSemesters(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Semesters...');
  const stats = startCollectionMigration('semesters', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} semesters`);
    return;
  }

  for (const sem of data) {
    const newId = convertId(sem._id, 'semesters');
    const institutionId = getMappedId(sem.institutionId, 'institutions');

    try {
      await prisma.semester.create({
        data: {
          id: newId,
          number: processNumber(sem.number) || 1,
          isActive: processBoolean(sem.isActive, true),
          institutionId: institutionId,
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating semester ${sem.number}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateScholarships(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Scholarships...');
  const stats = startCollectionMigration('scholarships', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} scholarships`);
    return;
  }

  for (const sch of data) {
    const newId = convertId(sch._id, 'scholarships');
    const institutionId = getMappedId(sch.institutionId, 'institutions');

    try {
      await prisma.scholarship.create({
        data: {
          id: newId,
          type: sch.type || 'PMS',
          amount: processNumber(sch.amount) || 0,
          status: sch.status,
          institutionId: institutionId,
          createdAt: processDate(sch.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating scholarship: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateFeeStructures(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Fee Structures...');
  const stats = startCollectionMigration('feeStructures', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} fee structures`);
    return;
  }

  const processedCombos = new Set<string>();

  for (const fs of data) {
    const newId = convertId(fs._id, 'feeStructures');
    const institutionId = getMappedId(fs.institutionId, 'institutions');

    const comboKey = `${fs.admissionType}-${fs.scholarshipScheme}-${fs.semesterNumber}`;
    if (processedCombos.has(comboKey)) {
      stats.skipped++;
      continue;
    }
    processedCombos.add(comboKey);

    try {
      await prisma.feeStructure.create({
        data: {
          id: newId,
          admissionType: fs.admissionType || 'FIRST_YEAR',
          scholarshipScheme: fs.scholarshipScheme || 'PMS',
          semesterNumber: processNumber(fs.semesterNumber) || 1,
          df: processNumber(fs.df) || 0,
          sf: processNumber(fs.sf) || 0,
          security: processNumber(fs.security) || 0,
          tf: processNumber(fs.tf) || 0,
          total: fs.total?.toString() || '0',
          isActive: processBoolean(fs.isActive, true),
          institutionId: institutionId,
          createdAt: processDate(fs.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating fee structure: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateSubjects(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Subjects...');
  const stats = startCollectionMigration('subjects', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} subjects`);
    return;
  }

  for (const subject of data) {
    const newId = convertId(subject._id, 'subjects');
    const branchId = getMappedId(subject.branchId, 'branches');
    const institutionId = getMappedId(subject.institutionId, 'institutions');

    try {
      await prisma.subject.create({
        data: {
          id: newId,
          subjectName: subject.subjectName || 'Unknown Subject',
          subjectCode: subject.subjectCode || `SUB-${Date.now()}`,
          syllabusYear: processNumber(subject.syllabusYear) || new Date().getFullYear(),
          semesterNumber: subject.semesterNumber?.toString(),
          branchName: subject.branchName || 'Unknown',
          maxMarks: processNumber(subject.maxMarks) || 100,
          subjectType: subject.subjectType || 'THEORY',
          branchId: branchId,
          institutionId: institutionId,
          createdAt: processDate(subject.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating subject ${subject.subjectName}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateStudents(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Students...');
  const stats = startCollectionMigration('students', data.length);
  const processedUserIds = new Set<string>();

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} students`);
    return;
  }

  for (const student of data) {
    const userId = getMappedId(student.userId, 'users');

    if (!userId) {
      stats.skipped++;
      if (config.verbose) logWarning(`Skipped student (MongoDB ID: ${student._id}, userId: ${student.userId}, rollNumber: ${student.rollNumber}) - no user mapping found`);
      continue;
    }

    if (processedUserIds.has(userId)) {
      // Map duplicate to existing
      const existingId = idMaps['students'].get(student._id?.toString() || '');
      if (!existingId) {
        idMaps['students'].set(student._id?.toString() || '', uuidv4());
      }
      stats.skipped++;
      if (config.verbose) logWarning(`Skipped duplicate student (MongoDB ID: ${student._id}, rollNumber: ${student.rollNumber}) - userId already processed`);
      continue;
    }

    processedUserIds.add(userId);
    const newId = convertId(student._id, 'students');
    const institutionId = getMappedId(student.institutionId, 'institutions');
    const branchId = getMappedId(student.branchId, 'branches');
    const batchId = getMappedId(student.batchId, 'batches');
    const scholarshipId = getMappedId(student.scholarshipId, 'scholarships');
    const feeStructureId = getMappedId(student.feeStuctureId || student.feeStructureId, 'feeStructures');

    try {
      await prisma.student.create({
        data: {
          id: newId,
          userId: userId,
          rollNumber: student.rollNumber,
          admissionNumber: student.admissionNumber,
          name: student.name || 'Unknown',
          email: student.email,
          contact: student.contact,
          gender: student.gender,
          dob: student.dob,
          address: student.address,
          city: student.city,
          state: student.state,
          pinCode: student.pinCode,
          tehsil: student.tehsil,
          district: student.district,
          parentName: student.parentName,
          parentContact: student.parentContact,
          motherName: student.motherName,
          institutionId: institutionId,
          branchId: branchId,
          branchName: student.branchName,
          batchId: batchId,
          currentYear: processNumber(student.currentYear),
          currentSemester: processNumber(student.currentSemester),
          currentSemesterMarks: processNumber(student.currentSemesterMarks),
          tenthper: processNumber(student.tenthper),
          twelthper: processNumber(student.twelthper),
          diplomaPercentage: processNumber(student.diplomaPercentage),
          totalBacklogs: processNumber(student.totalBacklogs) || 0,
          admissionType: student.admissionType,
          category: student.category,
          clearanceStatus: student.clearanceStatus || 'PENDING',
          isActive: processBoolean(student.isActive, true),
          profileImage: student.profilePicture || student.profileImage,
          scholarshipId: scholarshipId,
          feeStructureId: feeStructureId,
          createdAt: processDate(student.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating student ${student.rollNumber}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateIndustries(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Industries...');
  const stats = startCollectionMigration('industries', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} industries`);
    return;
  }

  for (const industry of data) {
    const newId = convertId(industry._id, 'industries');
    const userId = getMappedId(industry.userId, 'users');
    const institutionId = getMappedId(industry.institutionId, 'institutions');
    const referredById = getMappedId(industry.referredById, 'users');

    if (!userId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.industry.create({
        data: {
          id: newId,
          userId: userId,
          companyName: industry.companyName || 'Unknown Company',
          companyDescription: industry.companyDescription,
          industryType: industry.industryType || 'OTHER',
          establishedYear: processNumber(industry.establishedYear),
          companySize: industry.companySize || 'SMALL',
          employeeCount: processNumber(industry.employeeCount),
          contactPersonName: industry.contactPersonName || 'Contact',
          contactPersonTitle: industry.contactPersonTitle || 'Manager',
          primaryEmail: industry.primaryEmail || 'contact@company.com',
          alternateEmail: industry.alternateEmail,
          primaryPhone: industry.primaryPhone || '0000000000',
          alternatePhone: industry.alternatePhone,
          website: industry.website,
          address: industry.address || 'Address',
          city: industry.city || 'City',
          state: industry.state || 'State',
          pinCode: industry.pinCode || '000000',
          country: industry.country || 'India',
          registrationNumber: industry.registrationNumber || 'REG000',
          panNumber: industry.panNumber || 'PAN00000',
          gstNumber: industry.gstNumber,
          isVerified: processBoolean(industry.isVerified),
          verifiedAt: processDate(industry.verifiedAt),
          verifiedBy: industry.verifiedBy,
          isApproved: processBoolean(industry.isApproved),
          approvedAt: processDate(industry.approvedAt),
          approvedBy: industry.approvedBy,
          referredById: referredById,
          referralDate: processDate(industry.referralDate),
          referralNotes: industry.referralNotes,
          institutionId: institutionId,
          createdAt: processDate(industry.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating industry ${industry.companyName}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateInternships(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Internships...');
  const stats = startCollectionMigration('internships', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} internships`);
    return;
  }

  for (const internship of data) {
    const newId = convertId(internship._id, 'internships');
    const industryId = getMappedId(internship.industryId, 'industries');
    const institutionId = getMappedId(internship.institutionId, 'institutions');

    if (!industryId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.internship.create({
        data: {
          id: newId,
          title: internship.title || 'Untitled Internship',
          description: internship.description || '',
          detailedDescription: internship.detailedDescription,
          fieldOfWork: internship.fieldOfWork || internship.field || 'General',
          industryId: industryId,
          institutionId: institutionId,
          numberOfPositions: processNumber(internship.positions || internship.numberOfPositions) || 1,
          duration: internship.duration || '3 months',
          startDate: processDate(internship.startDate),
          endDate: processDate(internship.endDate),
          applicationDeadline: processDate(internship.applicationDeadline) || new Date(),
          workLocation: internship.location || internship.workLocation || '',
          isRemoteAllowed: processBoolean(internship.isRemoteAllowed),
          eligibleBranches: processArray(internship.eligibleBranches),
          minimumPercentage: processNumber(internship.minimumPercentage),
          eligibleSemesters: processArray(internship.eligibleSemesters),
          isStipendProvided: processBoolean(internship.isStipendProvided),
          stipendAmount: processNumber(internship.stipend || internship.stipendAmount),
          stipendDetails: internship.stipendDetails,
          requiredSkills: processArray(internship.skillRequirements || internship.requiredSkills),
          preferredSkills: processArray(internship.preferredSkills),
          totalFacultyVisits: processNumber(internship.totalFacultyVisits) || 4,
          status: internship.status || 'ACTIVE',
          isActive: processBoolean(internship.isActive, true),
          createdAt: processDate(internship.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating internship ${internship.title}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateInternshipApplications(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Internship Applications...');
  const stats = startCollectionMigration('internshipApplications', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} applications`);
    return;
  }

  for (const app of data) {
    const newId = convertId(app._id, 'internshipApplications');
    const studentId = getMappedId(app.studentId, 'students');
    const internshipId = getMappedId(app.internshipId, 'internships');
    const mentorId = getMappedId(app.mentorId, 'users');

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.internshipApplication.create({
        data: {
          id: newId,
          studentId: studentId,
          internshipId: internshipId,
          applicationDate: processDate(app.applicationDate) || new Date(),
          coverLetter: app.coverLetter,
          resume: app.resumeUrl || app.resume,
          additionalInfo: app.additionalInfo,
          status: app.status || 'APPLIED',
          appliedDate: processDate(app.appliedDate) || new Date(),
          reviewedDate: processDate(app.reviewedDate),
          isSelected: processBoolean(app.isSelected),
          selectionDate: processDate(app.selectionDate),
          rejectionReason: app.rejectionReason,
          hasJoined: processBoolean(app.hasJoined),
          joiningDate: processDate(app.joiningDate),
          completionDate: processDate(app.completionDate),
          mentorId: mentorId,
          mentorAssignedAt: processDate(app.mentorAssignedAt),
          mentorAssignedBy: app.mentorAssignedBy,
          isSelfIdentified: processBoolean(app.isSelfIdentified),
          companyName: app.companyName,
          companyAddress: app.companyAddress,
          companyContact: app.companyContact,
          companyEmail: app.companyEmail,
          hrName: app.hrName,
          hrDesignation: app.hrDesignation,
          hrContact: app.hrContact,
          hrEmail: app.hrEmail,
          internshipStatus: app.internshipStatus,
          joiningLetterUrl: app.offerLetterUrl || app.offerLetter || app.joiningLetterUrl,
          joiningLetterUploadedAt: processDate(app.joiningLetterUploadedAt),
          facultyMentorName: app.facultyMentorName,
          facultyMentorContact: app.facultyMentorContact,
          facultyMentorEmail: app.facultyMentorEmail,
          facultyMentorDesignation: app.facultyMentorDesignation,
          internshipDuration: app.internshipDuration,
          stipend: app.stipend,
          startDate: processDate(app.startDate),
          endDate: processDate(app.endDate),
          jobProfile: app.jobProfile,
          reviewedBy: app.reviewedBy,
          reviewedAt: processDate(app.reviewedAt),
          reviewRemarks: app.reviewRemarks,
          notes: app.noc || app.remarks || app.notes,
          proposedFirstVisit: processDate(app.proposedFirstVisit),
          secondVisit: processDate(app.secondVisit),
          createdAt: processDate(app.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating application (MongoDB ID: ${app._id}, studentId: ${app.studentId}, internshipId: ${app.internshipId}): ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateMentorAssignments(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Mentor Assignments...');
  const stats = startCollectionMigration('mentorAssignments', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} mentor assignments`);
    return;
  }

  for (const assign of data) {
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
          assignmentReason: assign.assignmentReason,
          isActive: processBoolean(assign.isActive, true),
          deactivatedAt: processDate(assign.deactivatedAt),
          deactivatedBy: assign.deactivatedBy,
          deactivationReason: assign.deactivationReason,
          academicYear: assign.academicYear || '2024-25',
          semester: assign.semester,
          specialInstructions: assign.specialInstructions,
          createdAt: processDate(assign.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating mentor assignment (MongoDB ID: ${assign._id}, studentId: ${assign.studentId}, mentorId: ${assign.mentorId}): ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateDocuments(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Documents...');
  const stats = startCollectionMigration('documents', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} documents`);
    return;
  }

  for (const doc of data) {
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
          fileName: doc.fileName || 'unknown_file',
          fileUrl: doc.fileUrl || '',
          createdAt: processDate(doc.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating document: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateFees(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Fees...');
  const stats = startCollectionMigration('fees', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} fees`);
    return;
  }

  for (const fee of data) {
    const newId = convertId(fee._id, 'fees');
    const studentId = getMappedId(fee.studentId, 'students');
    const semesterId = getMappedId(fee.semesterId, 'semesters');
    const feeStructureId = getMappedId(fee.feeStructureId, 'feeStructures');
    const institutionId = getMappedId(fee.institutionId, 'institutions');

    if (!studentId || !semesterId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.fee.create({
        data: {
          id: newId,
          studentId: studentId,
          semesterId: semesterId,
          feeStructureId: feeStructureId,
          amountDue: processNumber(fee.amountDue) || 0,
          amountPaid: processNumber(fee.amountPaid) || 0,
          dueDate: processDate(fee.dueDate) || new Date(),
          status: fee.status || 'PENDING',
          institutionId: institutionId,
          createdAt: processDate(fee.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating fee: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateExamResults(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Exam Results...');
  const stats = startCollectionMigration('examResults', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} exam results`);
    return;
  }

  for (const result of data) {
    const newId = convertId(result._id, 'examResults');
    const studentId = getMappedId(result.studentId, 'students');
    const semesterId = getMappedId(result.semesterId, 'semesters');
    const subjectId = getMappedId(result.subjectId, 'subjects');

    if (!studentId || !semesterId || !subjectId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.examResult.create({
        data: {
          id: newId,
          studentId: studentId,
          semesterId: semesterId,
          subjectId: subjectId,
          marks: processNumber(result.marks) || 0,
          maxMarks: processNumber(result.maxMarks) || 100,
          createdAt: processDate(result.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating exam result: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateNotifications(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Notifications...');
  const stats = startCollectionMigration('notifications', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} notifications`);
    return;
  }

  for (const notif of data) {
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
          title: notif.title || 'Notification',
          body: notif.body || '',
          type: notif.type,
          data: processJson(notif.data),
          read: processBoolean(notif.read),
          createdAt: processDate(notif.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating notification: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateMonthlyFeedbacks(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Monthly Feedbacks...');
  const stats = startCollectionMigration('monthlyFeedbacks', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} monthly feedbacks`);
    return;
  }

  for (const fb of data) {
    const newId = convertId(fb._id, 'monthlyFeedbacks');
    const applicationId = getMappedId(fb.applicationId, 'internshipApplications');
    const studentId = getMappedId(fb.studentId, 'students');
    const industryId = getMappedId(fb.industryId, 'industries');
    const internshipId = getMappedId(fb.internshipId, 'internships');

    if (!applicationId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.monthlyFeedback.create({
        data: {
          id: newId,
          applicationId: applicationId,
          studentId: studentId,
          industryId: industryId,
          internshipId: internshipId,
          imageUrl: fb.imageUrl,
          feedbackMonth: processDate(fb.feedbackMonth) || new Date(),
          attendanceRating: processNumber(fb.attendanceRating),
          performanceRating: processNumber(fb.performanceRating),
          punctualityRating: processNumber(fb.punctualityRating),
          technicalSkillsRating: processNumber(fb.technicalSkillsRating),
          strengths: fb.strengths,
          areasForImprovement: fb.areasForImprovement,
          tasksAssigned: fb.tasksAssigned,
          tasksCompleted: fb.tasksCompleted,
          overallComments: fb.overallComments,
          overallRating: processNumber(fb.overallRating),
          reportUrl: fb.reportUrl,
          workDescription: fb.workDescription,
          skillsLearned: fb.skillsLearned,
          challenges: fb.challenges,
          supervisorFeedback: fb.supervisorFeedback,
          submittedAt: processDate(fb.submittedAt) || new Date(),
          submittedBy: fb.submittedBy || '',
          createdAt: processDate(fb.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating monthly feedback: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateMonthlyReports(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Monthly Reports...');
  const stats = startCollectionMigration('monthlyReports', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} monthly reports`);
    return;
  }

  const processedCombos = new Set<string>();

  for (const report of data) {
    const newId = convertId(report._id, 'monthlyReports');
    const applicationId = getMappedId(report.applicationId, 'internshipApplications');
    const studentId = getMappedId(report.studentId, 'students');

    if (!applicationId || !studentId) {
      stats.skipped++;
      continue;
    }

    const comboKey = `${applicationId}-${report.reportMonth}-${report.reportYear}`;
    if (processedCombos.has(comboKey)) {
      stats.skipped++;
      continue;
    }
    processedCombos.add(comboKey);

    try {
      await prisma.monthlyReport.create({
        data: {
          id: newId,
          applicationId: applicationId,
          studentId: studentId,
          reportMonth: processNumber(report.reportMonth) || 1,
          reportYear: processNumber(report.reportYear) || new Date().getFullYear(),
          monthName: report.monthName,
          reportFileUrl: report.reportFileUrl,
          status: report.status || 'DRAFT',
          submittedAt: processDate(report.submittedAt),
          reviewedBy: report.reviewedBy,
          reviewedAt: processDate(report.reviewedAt),
          reviewComments: report.reviewerComments || report.reviewComments,
          isApproved: processBoolean(report.isApproved),
          approvedBy: report.approvedBy,
          approvedAt: processDate(report.approvedAt),
          createdAt: processDate(report.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating monthly report: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateFacultyVisitLogs(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Faculty Visit Logs...');
  const stats = startCollectionMigration('facultyVisitLogs', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} faculty visit logs`);
    return;
  }

  for (const visit of data) {
    const newId = convertId(visit._id, 'facultyVisitLogs');
    const applicationId = getMappedId(visit.applicationId, 'internshipApplications');
    const internshipId = getMappedId(visit.internshipId, 'internships');
    const facultyId = getMappedId(visit.facultyId, 'users');

    if (!applicationId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.facultyVisitLog.create({
        data: {
          id: newId,
          applicationId: applicationId,
          internshipId: internshipId,
          facultyId: facultyId,
          visitLocation: visit.visitLocation,
          visitNumber: processNumber(visit.visitNumber),
          visitDate: processDate(visit.visitDate),
          visitDuration: visit.visitDuration,
          visitType: visit.visitType || 'PHYSICAL',
          status: visit.status || 'SCHEDULED',
          studentPerformance: visit.studentPerformance,
          workEnvironment: visit.workEnvironment,
          industrySupport: visit.industrySupport,
          skillsDevelopment: visit.skillsDevelopment,
          attendanceStatus: visit.attendanceStatus,
          workQuality: visit.workQuality,
          organisationFeedback: visit.organisationFeedback,
          projectTopics: visit.projectTopics,
          titleOfProjectWork: visit.titleOfProjectWork,
          assistanceRequiredFromInstitute: visit.assistanceRequiredFromInstitute,
          responseFromOrganisation: visit.responseFromOrganisation,
          remarksOfOrganisationSupervisor: visit.remarksOfOrganisationSupervisor,
          significantChangeInPlan: visit.significantChangeInPlan,
          observationsAboutStudent: visit.observationsAboutStudent,
          feedbackSharedWithStudent: visit.feedbackSharedWithStudent,
          studentProgressRating: processNumber(visit.studentProgressRating),
          industryCooperationRating: processNumber(visit.industryCooperationRating),
          workEnvironmentRating: processNumber(visit.workEnvironmentRating),
          mentoringSupportRating: processNumber(visit.mentoringSupportRating),
          overallSatisfactionRating: processNumber(visit.overallSatisfactionRating),
          issuesIdentified: visit.issuesIdentified,
          recommendations: visit.recommendations,
          actionRequired: visit.actionRequired,
          filesUrl: visit.filesUrl,
          visitPhotos: processArray(visit.visitPhotos),
          meetingMinutes: visit.meetingMinutes,
          attendeesList: processArray(visit.attendeesList),
          reportSubmittedTo: visit.reportSubmittedTo,
          followUpRequired: processBoolean(visit.followUpRequired),
          nextVisitDate: processDate(visit.nextVisitDate),
          createdAt: processDate(visit.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating faculty visit: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateCompletionFeedbacks(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Completion Feedbacks...');
  const stats = startCollectionMigration('completionFeedbacks', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} completion feedbacks`);
    return;
  }

  for (const cf of data) {
    const newId = convertId(cf._id, 'completionFeedbacks');
    const applicationId = getMappedId(cf.applicationId, 'internshipApplications');
    const industryId = getMappedId(cf.industryId, 'industries');

    if (!applicationId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.completionFeedback.create({
        data: {
          id: newId,
          applicationId: applicationId,
          industryId: industryId,
          studentFeedback: cf.studentFeedback,
          studentRating: processNumber(cf.studentRating),
          skillsLearned: cf.skillsLearned,
          careerImpact: cf.careerImpact,
          wouldRecommend: processBoolean(cf.wouldRecommend),
          studentSubmittedAt: processDate(cf.studentSubmittedAt),
          industryFeedback: cf.industryFeedback,
          industryRating: processNumber(cf.industryRating),
          finalPerformance: cf.finalPerformance,
          recommendForHire: processBoolean(cf.recommendForHire),
          industrySubmittedAt: processDate(cf.industrySubmittedAt),
          isCompleted: processBoolean(cf.isCompleted),
          completionCertificate: cf.completionCertificate,
          createdAt: processDate(cf.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating completion feedback: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateGrievances(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Grievances...');
  const stats = startCollectionMigration('grievances', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} grievances`);
    return;
  }

  for (const grievance of data) {
    const newId = convertId(grievance._id, 'grievances');
    const studentId = getMappedId(grievance.studentId, 'students');
    const internshipId = getMappedId(grievance.internshipId, 'internships');
    const industryId = getMappedId(grievance.industryId, 'industries');
    const facultySupervisorId = getMappedId(grievance.facultySupervisorId, 'users');
    const assignedToId = getMappedId(grievance.assignedToId, 'users');

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.grievance.create({
        data: {
          id: newId,
          studentId: studentId,
          title: grievance.title || grievance.subject || 'Grievance',
          category: grievance.category || 'OTHER',
          description: grievance.description || '',
          severity: grievance.severity || grievance.priority || 'MEDIUM',
          status: grievance.status || 'PENDING',
          internshipId: internshipId,
          industryId: industryId,
          facultySupervisorId: facultySupervisorId,
          assignedToId: assignedToId,
          actionRequested: grievance.actionRequested,
          preferredContactMethod: grievance.preferredContactMethod,
          submittedDate: processDate(grievance.submittedDate) || new Date(),
          addressedDate: processDate(grievance.addressedDate),
          resolvedDate: processDate(grievance.resolvedDate || grievance.resolvedAt),
          resolution: grievance.resolution,
          comments: grievance.comments || grievance.remarks,
          attachments: processArray(grievance.attachments),
          escalationHistory: grievance.escalationHistory || [],
          escalatedById: grievance.escalatedById,
          escalatedAt: processDate(grievance.escalatedAt),
          escalationCount: processNumber(grievance.escalationCount) || 0,
          previousAssignees: processArray(grievance.previousAssignees),
          createdAt: processDate(grievance.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating grievance: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateAuditLogs(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Audit Logs...');
  const stats = startCollectionMigration('auditLogs', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} audit logs`);
    return;
  }

  for (const l of data) {
    const newId = convertId(l._id, 'auditLogs');
    const userId = getMappedId(l.userId, 'users');
    const institutionId = getMappedId(l.institutionId, 'institutions');

    try {
      await prisma.auditLog.create({
        data: {
          id: newId,
          userId: userId,
          action: l.action || 'USER_LOGIN',
          userRole: l.userRole || 'STUDENT',
          userName: l.userName,
          entityType: l.entityType || 'User',
          entityId: l.entityId,
          oldValues: processJson(l.oldValues),
          newValues: processJson(l.newValues),
          changedFields: processArray(l.changedFields),
          description: l.description,
          category: l.category || 'AUTHENTICATION',
          severity: l.severity || 'LOW',
          timestamp: processDate(l.timestamp) || new Date(),
          institutionId: institutionId,
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating audit log: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateCalendars(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Calendars...');
  const stats = startCollectionMigration('calendars', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} calendars`);
    return;
  }

  for (const cal of data) {
    const newId = convertId(cal._id, 'calendars');
    const institutionId = getMappedId(cal.institutionId, 'institutions');

    try {
      await prisma.calendar.create({
        data: {
          id: newId,
          institutionId: institutionId,
          title: cal.title || 'Calendar Event',
          startDate: processDate(cal.startDate),
          endDate: processDate(cal.endDate),
          createdAt: processDate(cal.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating calendar ${cal.title}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateNotices(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Notices...');
  const stats = startCollectionMigration('notices', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} notices`);
    return;
  }

  for (const notice of data) {
    const newId = convertId(notice._id, 'notices');
    const institutionId = getMappedId(notice.institutionId, 'institutions');

    try {
      await prisma.notice.create({
        data: {
          id: newId,
          institutionId: institutionId,
          title: notice.title || 'Notice',
          message: notice.message || '',
          createdAt: processDate(notice.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating notice ${notice.title}: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migratePlacements(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Placements...');
  const stats = startCollectionMigration('placements', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} placements`);
    return;
  }

  for (const placement of data) {
    const newId = convertId(placement._id, 'placements');
    const studentId = getMappedId(placement.studentId, 'students');
    const institutionId = getMappedId(placement.institutionId, 'institutions');

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.placement.create({
        data: {
          id: newId,
          studentId: studentId,
          companyName: placement.companyName || 'Unknown Company',
          jobRole: placement.jobRole || 'Unknown Role',
          salary: processNumber(placement.salary),
          offerDate: processDate(placement.offerDate) || new Date(),
          status: placement.status || 'OFFERED',
          institutionId: institutionId,
          createdAt: processDate(placement.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating placement: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateInternshipPreferences(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Internship Preferences...');
  const stats = startCollectionMigration('internshipPreferences', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} internship preferences`);
    return;
  }

  for (const pref of data) {
    const newId = convertId(pref._id, 'internshipPreferences');
    const studentId = getMappedId(pref.studentId, 'students');

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.internshipPreference.create({
        data: {
          id: newId,
          studentId: studentId,
          preferredFields: processArray(pref.preferredFields),
          preferredLocations: processArray(pref.preferredLocations),
          preferredDurations: processArray(pref.preferredDurations),
          minimumStipend: processNumber(pref.minimumStipend),
          isRemotePreferred: processBoolean(pref.isRemotePreferred),
          additionalRequirements: pref.additionalRequirements,
          createdAt: processDate(pref.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating internship preference: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateComplianceRecords(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Compliance Records...');
  const stats = startCollectionMigration('complianceRecords', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} compliance records`);
    return;
  }

  for (const record of data) {
    const newId = convertId(record._id, 'complianceRecords');
    const studentId = getMappedId(record.studentId, 'students');

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.complianceRecord.create({
        data: {
          id: newId,
          studentId: studentId,
          complianceType: record.complianceType || 'FACULTY_VISIT',
          status: record.status || 'PENDING_REVIEW',
          requiredVisits: processNumber(record.requiredVisits),
          completedVisits: processNumber(record.completedVisits),
          lastVisitDate: processDate(record.lastVisitDate),
          nextVisitDue: processDate(record.nextVisitDue),
          requiredFeedbacks: processNumber(record.requiredFeedbacks),
          completedFeedbacks: processNumber(record.completedFeedbacks),
          lastFeedbackDate: processDate(record.lastFeedbackDate),
          nextFeedbackDue: processDate(record.nextFeedbackDue),
          complianceScore: processNumber(record.complianceScore),
          complianceGrade: record.complianceGrade,
          remarks: record.remarks,
          actionRequired: record.actionRequired,
          reviewedBy: record.reviewedBy,
          reviewedAt: processDate(record.reviewedAt),
          nextReviewDate: processDate(record.nextReviewDate),
          academicYear: record.academicYear || '2024-25',
          semester: record.semester,
          createdAt: processDate(record.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating compliance record: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateTechnicalQueries(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Technical Queries...');
  const stats = startCollectionMigration('technicalQueries', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} technical queries`);
    return;
  }

  for (const query of data) {
    const newId = convertId(query._id, 'technicalQueries');
    const userId = getMappedId(query.userId, 'users');
    const institutionId = getMappedId(query.institutionId, 'institutions');

    if (!userId) {
      stats.skipped++;
      continue;
    }

    try {
      await prisma.technicalQuery.create({
        data: {
          id: newId,
          userId: userId,
          title: query.title,
          description: query.description,
          attachments: processArray(query.attachments),
          status: query.status || 'OPEN',
          priority: query.priority || 'MEDIUM',
          resolution: query.resolution,
          institutionId: institutionId,
          createdAt: processDate(query.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating technical query: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateBlacklistedTokens(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Blacklisted Tokens...');
  const stats = startCollectionMigration('blacklistedTokens', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} blacklisted tokens`);
    return;
  }

  for (const token of data) {
    const newId = convertId(token._id, 'blacklistedTokens');

    try {
      await prisma.blacklistedToken.create({
        data: {
          id: newId,
          token: token.token || '',
          userId: token.userId,
          reason: token.reason,
          isFullInvalidation: processBoolean(token.isFullInvalidation),
          expiresAt: processDate(token.expiresAt) || new Date(),
          createdAt: processDate(token.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating blacklisted token: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

async function migrateGeneratedReports(data: any[], prisma: PrismaClient, config: MigrationConfig): Promise<void> {
  logInfo('Migrating Generated Reports...');
  const stats = startCollectionMigration('generatedReports', data.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${data.length} generated reports`);
    return;
  }

  for (const report of data) {
    const newId = convertId(report._id, 'generatedReports');

    try {
      await prisma.generatedReport.create({
        data: {
          id: newId,
          reportType: report.reportType || 'custom',
          reportName: report.reportName,
          configuration: processJson(report.configuration) || {},
          fileUrl: report.fileUrl,
          format: report.format || 'pdf',
          totalRecords: processNumber(report.totalRecords),
          generatedAt: processDate(report.generatedAt) || new Date(),
          generatedBy: report.generatedBy || '',
          institutionId: report.institutionId,
          expiresAt: processDate(report.expiresAt) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: report.status || 'completed',
          errorMessage: report.errorMessage,
          createdAt: processDate(report.createdAt) || new Date(),
        },
      });
      stats.migrated++;
    } catch (error: any) {
      stats.errors++;
      if (config.verbose) logError(`Error migrating generated report: ${error.message}`);
    }
  }
  finishCollectionMigration(stats);
}

// =============================================================================
// Collection Name Mapping (MongoDB -> Handler)
// =============================================================================

const collectionMigrators: Record<string, (data: any[], prisma: PrismaClient, config: MigrationConfig) => Promise<void>> = {
  // Core entities (order matters!)
  'Institution': migrateInstitutions,
  'institutions': migrateInstitutions,
  'User': migrateUsers,
  'users': migrateUsers,
  'branches': migrateBranches,
  'Branch': migrateBranches,
  'departments': migrateDepartments,
  'Department': migrateDepartments,
  'Batch': migrateBatches,
  'batches': migrateBatches,
  'Semester': migrateSemesters,
  'semesters': migrateSemesters,
  'Scholarship': migrateScholarships,
  'scholarships': migrateScholarships,
  'FeeStructure': migrateFeeStructures,
  'feeStructures': migrateFeeStructures,
  'feestructures': migrateFeeStructures,
  'Subject': migrateSubjects,
  'subjects': migrateSubjects,
  'Student': migrateStudents,
  'students': migrateStudents,
  'industries': migrateIndustries,
  'Industry': migrateIndustries,
  'internships': migrateInternships,
  'Internship': migrateInternships,
  'internship_applications': migrateInternshipApplications,
  'internshipApplications': migrateInternshipApplications,
  'InternshipApplication': migrateInternshipApplications,
  'mentor_assignments': migrateMentorAssignments,
  'mentorAssignments': migrateMentorAssignments,
  'MentorAssignment': migrateMentorAssignments,
  'Document': migrateDocuments,
  'documents': migrateDocuments,
  'Fee': migrateFees,
  'fees': migrateFees,
  'ExamResult': migrateExamResults,
  'examResults': migrateExamResults,
  'examresults': migrateExamResults,
  'Notification': migrateNotifications,
  'notifications': migrateNotifications,
  'monthly_feedbacks': migrateMonthlyFeedbacks,
  'monthlyFeedbacks': migrateMonthlyFeedbacks,
  'MonthlyFeedback': migrateMonthlyFeedbacks,
  'monthly_reports': migrateMonthlyReports,
  'monthlyReports': migrateMonthlyReports,
  'MonthlyReport': migrateMonthlyReports,
  'faculty_visit_logs': migrateFacultyVisitLogs,
  'facultyVisitLogs': migrateFacultyVisitLogs,
  'FacultyVisitLog': migrateFacultyVisitLogs,
  'completion_feedbacks': migrateCompletionFeedbacks,
  'completionFeedbacks': migrateCompletionFeedbacks,
  'CompletionFeedback': migrateCompletionFeedbacks,
  'Grievance': migrateGrievances,
  'grievances': migrateGrievances,
  'AuditLog': migrateAuditLogs,
  'auditLogs': migrateAuditLogs,
  'auditlogs': migrateAuditLogs,
  'Calendar': migrateCalendars,
  'calendars': migrateCalendars,
  'Notice': migrateNotices,
  'notices': migrateNotices,
  'Placement': migratePlacements,
  'placements': migratePlacements,
  'internship_preferences': migrateInternshipPreferences,
  'internshipPreferences': migrateInternshipPreferences,
  'InternshipPreference': migrateInternshipPreferences,
  'compliance_records': migrateComplianceRecords,
  'complianceRecords': migrateComplianceRecords,
  'ComplianceRecord': migrateComplianceRecords,
  'technical_queries': migrateTechnicalQueries,
  'technicalQueries': migrateTechnicalQueries,
  'TechnicalQuery': migrateTechnicalQueries,
  'blacklistedTokens': migrateBlacklistedTokens,
  'BlacklistedToken': migrateBlacklistedTokens,
  'generatedReports': migrateGeneratedReports,
  'GeneratedReport': migrateGeneratedReports,
};

// Migration order (dependencies first)
const migrationOrder = [
  'Institution', 'institutions',
  'User', 'users',
  'branches', 'Branch',
  'departments', 'Department',
  'Batch', 'batches',
  'Semester', 'semesters',
  'Scholarship', 'scholarships',
  'FeeStructure', 'feeStructures', 'feestructures',
  'Subject', 'subjects',
  'Student', 'students',
  'industries', 'Industry',
  'internships', 'Internship',
  'internship_applications', 'internshipApplications', 'InternshipApplication',
  'mentor_assignments', 'mentorAssignments', 'MentorAssignment',
  'Document', 'documents',
  'Fee', 'fees',
  'ExamResult', 'examResults', 'examresults',
  'Notification', 'notifications',
  'monthly_feedbacks', 'monthlyFeedbacks', 'MonthlyFeedback',
  'monthly_reports', 'monthlyReports', 'MonthlyReport',
  'faculty_visit_logs', 'facultyVisitLogs', 'FacultyVisitLog',
  'completion_feedbacks', 'completionFeedbacks', 'CompletionFeedback',
  'Grievance', 'grievances',
  'AuditLog', 'auditLogs', 'auditlogs',
  'Calendar', 'calendars',
  'Notice', 'notices',
  'Placement', 'placements',
  'internship_preferences', 'internshipPreferences', 'InternshipPreference',
  'compliance_records', 'complianceRecords', 'ComplianceRecord',
  'technical_queries', 'technicalQueries', 'TechnicalQuery',
  'blacklistedTokens', 'BlacklistedToken',
  'generatedReports', 'GeneratedReport',
];

// =============================================================================
// Main Migration Function
// =============================================================================

async function main() {
  const config = parseArgs();

  logSection('MongoDB Backup to PostgreSQL Migration');

  // Validate configuration
  if (!config.backupPath) {
    logError('Backup path is required. Use --backup <path>');
    printHelp();
    process.exit(1);
  }

  console.log('');
  log('Configuration:', 'cyan');
  log(`  Backup File: ${config.backupPath}`);
  log(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}`);
  log(`  Verbose: ${config.verbose ? 'Yes' : 'No'}`);
  log(`  Skip Clear: ${config.skipClear ? 'Yes' : 'No'}`);

  // Load BSON library
  await loadBSON();

  // Initialize Prisma with adapter
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    // Test PostgreSQL connection
    logPhase('Testing PostgreSQL Connection');
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logSuccess('PostgreSQL connection successful');

    // Extract backup
    const extractPath = await extractBackup(config);

    // Find collections
    logPhase('Scanning for Collections');
    const collections = await findCollections(extractPath);
    logInfo(`Found ${collections.size} collections`);

    for (const [name, path] of collections) {
      log(`    - ${name}: ${path}`, 'reset');
    }

    // Clear PostgreSQL tables
    if (!config.dryRun && !config.skipClear) {
      logPhase('Clearing PostgreSQL Tables');
      try {
        await prisma.$executeRaw`
          DO $$
          DECLARE
            r RECORD;
          BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations') LOOP
              EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
            END LOOP;
          END $$;
        `;
        logSuccess('PostgreSQL tables cleared');
      } catch (e: any) {
        logWarning(`Could not clear tables: ${e.message}`);
      }
    }

    // Run migrations in order
    logPhase('Starting Data Migration');
    const startTime = Date.now();
    const migratedCollections = new Set<string>();

    for (const collectionName of migrationOrder) {
      // Skip if already migrated or no data
      if (migratedCollections.has(collectionName.toLowerCase())) continue;

      const filePath = collections.get(collectionName);
      if (!filePath) continue;

      const migrator = collectionMigrators[collectionName];
      if (!migrator) continue;

      const data = await loadCollectionData(filePath);
      if (data.length > 0) {
        await migrator(data, prisma, config);
        migratedCollections.add(collectionName.toLowerCase());
      }
    }

    // Handle any remaining collections not in the order list
    for (const [collectionName, filePath] of collections) {
      if (migratedCollections.has(collectionName.toLowerCase())) continue;

      const migrator = collectionMigrators[collectionName];
      if (!migrator) {
        logWarning(`No migrator for collection: ${collectionName}`);
        continue;
      }

      const data = await loadCollectionData(filePath);
      if (data.length > 0) {
        await migrator(data, prisma, config);
        migratedCollections.add(collectionName.toLowerCase());
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Print summary
    logSection('Migration Summary');

    if (config.dryRun) {
      logWarning('DRY RUN - No data was actually migrated');
    }

    console.log('');
    log('Records by collection:', 'cyan');
    let totalMigrated = 0;
    let totalErrors = 0;
    for (const stats of allStats) {
      if (stats.migrated > 0 || stats.errors > 0) {
        const status = stats.errors > 0 ? colors.yellow : colors.green;
        console.log(`  ${status}${stats.collection}: ${stats.migrated} migrated, ${stats.errors} errors${colors.reset}`);
        totalMigrated += stats.migrated;
        totalErrors += stats.errors;
      }
    }

    console.log('');
    log(`Total records migrated: ${totalMigrated}`, 'green');
    if (totalErrors > 0) {
      log(`Total errors: ${totalErrors}`, 'yellow');
    }
    log(`Total migration time: ${totalTime}s`, 'cyan');

    // Cleanup
    if (fs.existsSync(config.extractPath)) {
      fs.rmSync(config.extractPath, { recursive: true });
      logInfo('Cleaned up temporary files');
    }

    if (!config.dryRun) {
      logSuccess('Migration completed successfully!');
    }

  } catch (error: any) {
    logError(`Migration failed: ${error.message}`);
    if (config.verbose) {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  logError(e.message);
  process.exit(1);
});
