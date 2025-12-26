/**
 * =============================================================================
 * FILE MIGRATION SCRIPT: Local Storage -> MinIO
 * =============================================================================
 *
 * This script migrates files from the extracted backup to MinIO storage and
 * updates the database with new URLs.
 *
 * OLD STRUCTURE:
 *   uploads/{institution}/joining-letters/{rollNumber}_joiningletter.pdf
 *   uploads/{institution}/profile/{rollNumber}_profile.webp
 *   uploads/{institution}/document/{rollNumber}_{docType}_document.webp
 *
 * NEW STRUCTURE (MinIO):
 *   institutions/{institutionId}/students/{studentId}/joining-letter/...
 *   institutions/{institutionId}/students/{studentId}/profile/...
 *   institutions/{institutionId}/students/{studentId}/other/...
 *
 * USAGE:
 *   npx ts-node scripts/migrate-files-to-minio.ts [extracted_uploads_path]
 *
 * EXAMPLE:
 *   npx ts-node scripts/migrate-files-to-minio.ts "../prisma backup/extracted/uploads"
 *
 * =============================================================================
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  MINIO_BUCKET: process.env.MINIO_BUCKET || 'cms-files',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'minioadmin',
  MINIO_REGION: process.env.MINIO_REGION || 'us-east-1',

  DEFAULT_UPLOADS_PATH: path.resolve(__dirname, '../../prisma backup/extracted/uploads'),
  DRY_RUN: process.env.DRY_RUN === 'true',
  LOG_FILE: path.resolve(__dirname, '../logs/file-migration.log'),
};

// =============================================================================
// TYPES
// =============================================================================

interface StudentMapping {
  id: string;
  rollNumber: string;
  institutionId: string;
}

interface InstitutionMapping {
  id: string;
  name: string;
  sanitizedName: string;
}

interface FileInfo {
  localPath: string;
  rollNumber: string;
  fileType: 'joining-letter' | 'profile' | 'document' | 'other';
  documentType?: string;
  extension: string;
}

interface MigrationStats {
  joiningLetters: { scanned: number; migrated: number; errors: number; notFound: number };
  profiles: { scanned: number; migrated: number; errors: number; notFound: number };
  documents: { scanned: number; migrated: number; errors: number; notFound: number };
}

// =============================================================================
// LOGGING
// =============================================================================

let logStream: fs.WriteStream | null = null;

function initLogging() {
  const logsDir = path.dirname(CONFIG.LOG_FILE);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  logStream = fs.createWriteStream(CONFIG.LOG_FILE, { flags: 'a' });
}

function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = {
    INFO: '\x1b[36m[INFO]\x1b[0m',
    WARN: '\x1b[33m[WARN]\x1b[0m',
    ERROR: '\x1b[31m[ERROR]\x1b[0m',
    SUCCESS: '\x1b[32m[SUCCESS]\x1b[0m',
  }[level];

  console.log(`[${timestamp}] ${prefix} ${message}`);
  if (logStream) {
    logStream.write(`[${timestamp}] [${level}] ${message}\n`);
  }
}

function logSection(title: string) {
  log('\n' + '='.repeat(70));
  log(title);
  log('='.repeat(70));
}

// =============================================================================
// MINIO HELPERS
// =============================================================================

function createMinioClient(): S3Client {
  return new S3Client({
    endpoint: CONFIG.MINIO_ENDPOINT,
    region: CONFIG.MINIO_REGION,
    credentials: {
      accessKeyId: CONFIG.MINIO_ACCESS_KEY,
      secretAccessKey: CONFIG.MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
  });
}

async function testMinioConnection(s3: S3Client): Promise<boolean> {
  try {
    await s3.send(new ListBucketsCommand({}));
    return true;
  } catch (error: any) {
    log(`MinIO connection failed: ${error.message}`, 'ERROR');
    return false;
  }
}

async function ensureBucketExists(s3: S3Client): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: CONFIG.MINIO_BUCKET }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      try {
        await s3.send(new CreateBucketCommand({ Bucket: CONFIG.MINIO_BUCKET }));
        log(`Bucket "${CONFIG.MINIO_BUCKET}" created`);
        return true;
      } catch (createErr: any) {
        log(`Failed to create bucket: ${createErr.message}`, 'ERROR');
        return false;
      }
    }
    return false;
  }
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return types[ext] || 'application/octet-stream';
}

async function uploadToMinio(
  s3: S3Client,
  localPath: string,
  minioKey: string
): Promise<string> {
  const buffer = fs.readFileSync(localPath);
  const contentType = getContentType(localPath);

  await s3.send(
    new PutObjectCommand({
      Bucket: CONFIG.MINIO_BUCKET,
      Key: minioKey,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${CONFIG.MINIO_ENDPOINT}/${CONFIG.MINIO_BUCKET}/${minioKey}`;
}

// =============================================================================
// DATABASE HELPERS
// =============================================================================

function sanitizeFolderName(name: string): string {
  if (!name) return 'default';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}

async function buildStudentMapping(db: Db): Promise<Map<string, StudentMapping>> {
  log('Building student rollNumber -> ID mapping...');

  const students = await db.collection('Student').find({
    rollNumber: { $exists: true, $ne: null },
    institutionId: { $exists: true, $ne: null },
  }).toArray();

  const mapping = new Map<string, StudentMapping>();

  for (const student of students) {
    if (student.rollNumber && student.institutionId) {
      const rollNumber = student.rollNumber.toString().trim();
      mapping.set(rollNumber, {
        id: student._id.toString(),
        rollNumber,
        institutionId: student.institutionId.toString(),
      });
    }
  }

  log(`  Found ${mapping.size} students with rollNumbers`);
  return mapping;
}

async function buildInstitutionMapping(db: Db): Promise<Map<string, InstitutionMapping>> {
  log('Building institution name -> ID mapping...');

  const institutions = await db.collection('Institution').find({}).toArray();
  const mapping = new Map<string, InstitutionMapping>();

  for (const inst of institutions) {
    const name = inst.name || inst.shortName || '';
    const sanitized = sanitizeFolderName(name);
    mapping.set(sanitized, {
      id: inst._id.toString(),
      name,
      sanitizedName: sanitized,
    });
  }

  log(`  Found ${mapping.size} institutions`);
  return mapping;
}

// =============================================================================
// FILE PARSING
// =============================================================================

function parseFilename(filename: string, folder: string): FileInfo | null {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);

  // joining-letters: {rollNumber}_joiningletter.pdf
  if (folder === 'joining-letters') {
    const match = baseName.match(/^(.+?)_joiningletter$/i);
    if (match) {
      return {
        localPath: '',
        rollNumber: match[1].trim(),
        fileType: 'joining-letter',
        extension: ext,
      };
    }
  }

  // profile: {rollNumber}_profile.webp
  if (folder === 'profile') {
    const match = baseName.match(/^(.+?)_profile$/i);
    if (match) {
      return {
        localPath: '',
        rollNumber: match[1].trim(),
        fileType: 'profile',
        extension: ext,
      };
    }
  }

  // document: {rollNumber}_{docType}_document.webp
  if (folder === 'document') {
    const match = baseName.match(/^(.+?)_(.+?)_document$/i);
    if (match) {
      return {
        localPath: '',
        rollNumber: match[1].trim(),
        fileType: 'document',
        documentType: match[2],
        extension: ext,
      };
    }
  }

  return null;
}

function buildMinioKey(fileInfo: FileInfo, student: StudentMapping): string {
  const { institutionId, id: studentId } = student;
  const ext = fileInfo.extension.startsWith('.') ? fileInfo.extension.slice(1) : fileInfo.extension;

  switch (fileInfo.fileType) {
    case 'joining-letter':
      return `institutions/${institutionId}/students/${studentId}/joining-letter/${studentId}_joining-letter.${ext}`;
    case 'profile':
      return `institutions/${institutionId}/students/${studentId}/profile/${studentId}_profile.${ext}`;
    case 'document':
      return `institutions/${institutionId}/students/${studentId}/other/${studentId}_${fileInfo.documentType}.${ext}`;
    default:
      return `institutions/${institutionId}/students/${studentId}/other/${studentId}_file.${ext}`;
  }
}

// =============================================================================
// MIGRATION FUNCTIONS
// =============================================================================

async function migrateJoiningLetters(
  db: Db,
  s3: S3Client,
  uploadsPath: string,
  studentMapping: Map<string, StudentMapping>
): Promise<MigrationStats['joiningLetters']> {
  const stats = { scanned: 0, migrated: 0, errors: 0, notFound: 0 };
  const internshipCollection = db.collection('internship_applications');

  // Find all joining-letters folders in institution folders
  const institutionFolders = fs.readdirSync(uploadsPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && !['profile', 'document', 'other', 'temp', 'reports', 'report', 'faculty-visit-logs', 'technical_queries', 'internship-applications'].includes(d.name))
    .map(d => d.name);

  for (const instFolder of institutionFolders) {
    const joiningPath = path.join(uploadsPath, instFolder, 'joining-letters');
    if (!fs.existsSync(joiningPath)) continue;

    const files = fs.readdirSync(joiningPath).filter(f => {
      const ext = f.toLowerCase();
      return ext.endsWith('.pdf') || ext.endsWith('.webp') || ext.endsWith('.jpg') || ext.endsWith('.png');
    });

    for (const file of files) {
      stats.scanned++;
      const parsed = parseFilename(file, 'joining-letters');
      if (!parsed) {
        log(`  Cannot parse: ${file}`, 'WARN');
        stats.errors++;
        continue;
      }

      const student = studentMapping.get(parsed.rollNumber);
      if (!student) {
        log(`  Student not found for roll: ${parsed.rollNumber} (${file})`, 'WARN');
        stats.notFound++;
        continue;
      }

      const localPath = path.join(joiningPath, file);
      const minioKey = buildMinioKey(parsed, student);

      if (CONFIG.DRY_RUN) {
        log(`  [DRY_RUN] ${file} -> ${minioKey}`);
        stats.migrated++;
        continue;
      }

      try {
        const url = await uploadToMinio(s3, localPath, minioKey);

        // Update InternshipApplication.joiningLetterUrl
        await internshipCollection.updateMany(
          { studentId: new ObjectId(student.id) },
          {
            $set: {
              joiningLetterUrl: url,
              joiningLetterUploadedAt: new Date(),
            },
          }
        );

        log(`  ✓ ${file} -> ${minioKey}`);
        stats.migrated++;
      } catch (err: any) {
        log(`  ✗ ${file}: ${err.message}`, 'ERROR');
        stats.errors++;
      }
    }
  }

  return stats;
}

async function migrateProfiles(
  db: Db,
  s3: S3Client,
  uploadsPath: string,
  studentMapping: Map<string, StudentMapping>
): Promise<MigrationStats['profiles']> {
  const stats = { scanned: 0, migrated: 0, errors: 0, notFound: 0 };
  const studentCollection = db.collection('Student');

  const institutionFolders = fs.readdirSync(uploadsPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && !['profile', 'document', 'other', 'temp', 'reports', 'report', 'faculty-visit-logs', 'technical_queries', 'internship-applications'].includes(d.name))
    .map(d => d.name);

  for (const instFolder of institutionFolders) {
    const profilePath = path.join(uploadsPath, instFolder, 'profile');
    if (!fs.existsSync(profilePath)) continue;

    const files = fs.readdirSync(profilePath).filter(f => f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.png'));

    for (const file of files) {
      stats.scanned++;
      const parsed = parseFilename(file, 'profile');
      if (!parsed) {
        log(`  Cannot parse: ${file}`, 'WARN');
        stats.errors++;
        continue;
      }

      const student = studentMapping.get(parsed.rollNumber);
      if (!student) {
        log(`  Student not found for roll: ${parsed.rollNumber} (${file})`, 'WARN');
        stats.notFound++;
        continue;
      }

      const localPath = path.join(profilePath, file);
      const minioKey = buildMinioKey(parsed, student);

      if (CONFIG.DRY_RUN) {
        log(`  [DRY_RUN] ${file} -> ${minioKey}`);
        stats.migrated++;
        continue;
      }

      try {
        const url = await uploadToMinio(s3, localPath, minioKey);

        // Update Student.profileImage
        await studentCollection.updateOne(
          { _id: new ObjectId(student.id) },
          { $set: { profileImage: url } }
        );

        log(`  ✓ ${file} -> ${minioKey}`);
        stats.migrated++;
      } catch (err: any) {
        log(`  ✗ ${file}: ${err.message}`, 'ERROR');
        stats.errors++;
      }
    }
  }

  return stats;
}

async function migrateDocuments(
  db: Db,
  s3: S3Client,
  uploadsPath: string,
  studentMapping: Map<string, StudentMapping>
): Promise<MigrationStats['documents']> {
  const stats = { scanned: 0, migrated: 0, errors: 0, notFound: 0 };
  const documentCollection = db.collection('Document');

  const institutionFolders = fs.readdirSync(uploadsPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && !['profile', 'document', 'other', 'temp', 'reports', 'report', 'faculty-visit-logs', 'technical_queries', 'internship-applications'].includes(d.name))
    .map(d => d.name);

  for (const instFolder of institutionFolders) {
    const docPath = path.join(uploadsPath, instFolder, 'document');
    if (!fs.existsSync(docPath)) continue;

    const files = fs.readdirSync(docPath);

    for (const file of files) {
      stats.scanned++;
      const parsed = parseFilename(file, 'document');
      if (!parsed) {
        log(`  Cannot parse: ${file}`, 'WARN');
        stats.errors++;
        continue;
      }

      const student = studentMapping.get(parsed.rollNumber);
      if (!student) {
        log(`  Student not found for roll: ${parsed.rollNumber} (${file})`, 'WARN');
        stats.notFound++;
        continue;
      }

      const localPath = path.join(docPath, file);
      const minioKey = buildMinioKey(parsed, student);

      if (CONFIG.DRY_RUN) {
        log(`  [DRY_RUN] ${file} -> ${minioKey}`);
        stats.migrated++;
        continue;
      }

      try {
        const url = await uploadToMinio(s3, localPath, minioKey);

        // Map document type to enum
        const docTypeMap: Record<string, string> = {
          'marksheet_10th': 'MARKSHEET_10TH',
          'marksheet_12th': 'MARKSHEET_12TH',
          'caste_certificate': 'CASTE_CERTIFICATE',
          'photo': 'PHOTO',
        };
        const docType = docTypeMap[parsed.documentType?.toLowerCase() || ''] || 'OTHER';

        // Update Document.fileUrl
        await documentCollection.updateMany(
          {
            studentId: new ObjectId(student.id),
            type: docType,
          },
          { $set: { fileUrl: url } }
        );

        log(`  ✓ ${file} -> ${minioKey}`);
        stats.migrated++;
      } catch (err: any) {
        log(`  ✗ ${file}: ${err.message}`, 'ERROR');
        stats.errors++;
      }
    }
  }

  return stats;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const startTime = Date.now();
  initLogging();

  logSection('FILE MIGRATION: Local Storage -> MinIO');
  log(`Timestamp: ${new Date().toISOString()}`);
  log(`DRY_RUN: ${CONFIG.DRY_RUN}`);

  const uploadsPath = process.argv[2] || CONFIG.DEFAULT_UPLOADS_PATH;
  log(`Uploads path: ${uploadsPath}`);

  if (!fs.existsSync(uploadsPath)) {
    log(`Uploads path not found: ${uploadsPath}`, 'ERROR');
    process.exit(1);
  }

  // Initialize MinIO
  log('\nInitializing MinIO...');
  const s3 = createMinioClient();

  if (!(await testMinioConnection(s3))) {
    log('Cannot connect to MinIO', 'ERROR');
    process.exit(1);
  }
  log('MinIO connected', 'SUCCESS');

  if (!(await ensureBucketExists(s3))) {
    log('Cannot access bucket', 'ERROR');
    process.exit(1);
  }
  log(`Bucket "${CONFIG.MINIO_BUCKET}" ready`, 'SUCCESS');

  // Connect to MongoDB
  log('\nConnecting to MongoDB...');
  const client = new MongoClient(CONFIG.DATABASE_URL);

  try {
    await client.connect();
    log('MongoDB connected', 'SUCCESS');

    const db = client.db();

    // Build mappings
    const studentMapping = await buildStudentMapping(db);
    await buildInstitutionMapping(db);

    if (studentMapping.size === 0) {
      log('No students found in database!', 'ERROR');
      process.exit(1);
    }

    // Migrate files
    const stats: MigrationStats = {
      joiningLetters: { scanned: 0, migrated: 0, errors: 0, notFound: 0 },
      profiles: { scanned: 0, migrated: 0, errors: 0, notFound: 0 },
      documents: { scanned: 0, migrated: 0, errors: 0, notFound: 0 },
    };

    logSection('MIGRATING JOINING LETTERS');
    stats.joiningLetters = await migrateJoiningLetters(db, s3, uploadsPath, studentMapping);

    logSection('MIGRATING PROFILES');
    stats.profiles = await migrateProfiles(db, s3, uploadsPath, studentMapping);

    logSection('MIGRATING DOCUMENTS');
    stats.documents = await migrateDocuments(db, s3, uploadsPath, studentMapping);

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logSection('MIGRATION SUMMARY');
    log(`Duration: ${duration} seconds`);
    log('');
    log('Joining Letters:');
    log(`  Scanned: ${stats.joiningLetters.scanned}`);
    log(`  Migrated: ${stats.joiningLetters.migrated}`);
    log(`  Not Found: ${stats.joiningLetters.notFound}`);
    log(`  Errors: ${stats.joiningLetters.errors}`);
    log('');
    log('Profiles:');
    log(`  Scanned: ${stats.profiles.scanned}`);
    log(`  Migrated: ${stats.profiles.migrated}`);
    log(`  Not Found: ${stats.profiles.notFound}`);
    log(`  Errors: ${stats.profiles.errors}`);
    log('');
    log('Documents:');
    log(`  Scanned: ${stats.documents.scanned}`);
    log(`  Migrated: ${stats.documents.migrated}`);
    log(`  Not Found: ${stats.documents.notFound}`);
    log(`  Errors: ${stats.documents.errors}`);
    log('');

    const totalMigrated = stats.joiningLetters.migrated + stats.profiles.migrated + stats.documents.migrated;
    const totalErrors = stats.joiningLetters.errors + stats.profiles.errors + stats.documents.errors;

    log(`TOTAL: ${totalMigrated} files migrated, ${totalErrors} errors`, 'SUCCESS');

    if (CONFIG.DRY_RUN) {
      log('');
      log('This was a DRY RUN. No files were actually migrated.', 'WARN');
      log('Set DRY_RUN=false to perform actual migration.', 'WARN');
    }

    log(`\nLog file: ${CONFIG.LOG_FILE}`, 'SUCCESS');
  } finally {
    await client.close();
    if (logStream) logStream.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
