/**
 * =============================================================================
 * SYNC MINIO PROFILE IMAGES SCRIPT
 * =============================================================================
 *
 * This script scans MinIO for existing profile images and updates the database
 * with the correct URLs for students who don't have profileImage set.
 *
 * USAGE:
 *   npx ts-node scripts/sync-minio-profile-images.ts
 *
 * OPTIONS:
 *   DRY_RUN=true  - Only show what would be updated without making changes
 *
 * =============================================================================
 */

import { MongoClient, ObjectId } from 'mongodb';
import {
  S3Client,
  ListObjectsV2Command,
  ListBucketsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
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
  MINIO_BUCKET: process.env.MINIO_BUCKET || 'cms-uploads',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'minioadmin123',
  MINIO_REGION: process.env.MINIO_REGION || 'us-east-1',
  DRY_RUN: process.env.DRY_RUN === 'true',
};

// =============================================================================
// LOGGING
// =============================================================================

function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = {
    INFO: '\x1b[36m[INFO]\x1b[0m',
    WARN: '\x1b[33m[WARN]\x1b[0m',
    ERROR: '\x1b[31m[ERROR]\x1b[0m',
    SUCCESS: '\x1b[32m[SUCCESS]\x1b[0m',
  }[level];

  console.log(`[${timestamp}] ${prefix} ${message}`);
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

interface ProfileImageInfo {
  key: string;
  studentId: string;
  institutionId: string;
  url: string;
}

async function listProfileImages(s3: S3Client): Promise<ProfileImageInfo[]> {
  const profileImages: ProfileImageInfo[] = [];
  let continuationToken: string | undefined;

  log('Scanning MinIO for profile images...');

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: CONFIG.MINIO_BUCKET,
        Prefix: 'institutions/',
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of response.Contents || []) {
      const key = obj.Key;
      if (!key) continue;

      // Match pattern: institutions/{institutionId}/students/{studentId}/profile/{filename}
      const match = key.match(
        /^institutions\/([^\/]+)\/students\/([^\/]+)\/profile\/(.+)$/
      );

      if (match) {
        const [, institutionId, studentId, filename] = match;

        // Skip if not an image file
        if (!/\.(webp|jpg|jpeg|png|gif)$/i.test(filename)) {
          continue;
        }

        profileImages.push({
          key,
          institutionId,
          studentId,
          url: `${CONFIG.MINIO_ENDPOINT}/${CONFIG.MINIO_BUCKET}/${key}`,
        });
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  log(`Found ${profileImages.length} profile images in MinIO`);
  return profileImages;
}

// Also check for profile images in the old "profile/" folder structure
async function listOldProfileImages(s3: S3Client): Promise<Map<string, string>> {
  const profileMap = new Map<string, string>(); // rollNumber -> url
  let continuationToken: string | undefined;

  log('Scanning MinIO for old-style profile images (profile/ folder)...');

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: CONFIG.MINIO_BUCKET,
        Prefix: 'profile/',
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of response.Contents || []) {
      const key = obj.Key;
      if (!key) continue;

      // Match pattern: profile/{rollNumber}_profile.{ext} or profile/profile-{something}.{ext}
      const filename = key.split('/').pop() || '';

      // Try to extract roll number from filename like "ROLL123_profile.webp"
      const match = filename.match(/^(.+?)_profile\.(webp|jpg|jpeg|png|gif)$/i);
      if (match) {
        const rollNumber = match[1];
        profileMap.set(rollNumber, `${CONFIG.MINIO_ENDPOINT}/${CONFIG.MINIO_BUCKET}/${key}`);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  log(`Found ${profileMap.size} old-style profile images`);
  return profileMap;
}

// =============================================================================
// MAIN SYNC FUNCTION
// =============================================================================

async function main() {
  const startTime = Date.now();

  logSection('SYNC MINIO PROFILE IMAGES TO DATABASE');
  log(`Timestamp: ${new Date().toISOString()}`);
  log(`DRY_RUN: ${CONFIG.DRY_RUN}`);
  log(`MinIO Endpoint: ${CONFIG.MINIO_ENDPOINT}`);
  log(`MinIO Bucket: ${CONFIG.MINIO_BUCKET}`);

  // Initialize MinIO
  log('\nInitializing MinIO...');
  const s3 = createMinioClient();

  if (!(await testMinioConnection(s3))) {
    log('Cannot connect to MinIO', 'ERROR');
    process.exit(1);
  }
  log('MinIO connected', 'SUCCESS');

  // Connect to MongoDB
  log('\nConnecting to MongoDB...');
  const client = new MongoClient(CONFIG.DATABASE_URL);

  try {
    await client.connect();
    log('MongoDB connected', 'SUCCESS');

    const db = client.db();
    const studentCollection = db.collection('Student');

    // Get all students
    const students = await studentCollection.find({}).toArray();
    log(`Found ${students.length} students in database`);

    // Count students with/without profile images
    const studentsWithImage = students.filter(s => s.profileImage);
    const studentsWithoutImage = students.filter(s => !s.profileImage);
    log(`  - With profileImage: ${studentsWithImage.length}`);
    log(`  - Without profileImage: ${studentsWithoutImage.length}`);

    // Build student lookup maps
    const studentById = new Map<string, any>();
    const studentByRoll = new Map<string, any>();
    for (const student of students) {
      studentById.set(student._id.toString(), student);
      if (student.rollNumber) {
        studentByRoll.set(student.rollNumber.toString().trim(), student);
      }
    }

    // List profile images from MinIO
    const newStyleImages = await listProfileImages(s3);
    const oldStyleImages = await listOldProfileImages(s3);

    let updated = 0;
    let alreadySet = 0;
    let notFound = 0;
    let errors = 0;

    logSection('UPDATING STUDENTS FROM NEW-STYLE PATHS');

    // Process new-style images (institutions/{id}/students/{id}/profile/)
    for (const img of newStyleImages) {
      const student = studentById.get(img.studentId);

      if (!student) {
        log(`  Student not found for ID: ${img.studentId}`, 'WARN');
        notFound++;
        continue;
      }

      if (student.profileImage) {
        // Already has an image - skip or update if it's a different URL
        if (student.profileImage === img.url || student.profileImage === img.key) {
          alreadySet++;
          continue;
        }
        log(`  Updating existing image for ${student.name || student.rollNumber}: ${student.profileImage} -> ${img.key}`);
      }

      if (CONFIG.DRY_RUN) {
        log(`  [DRY_RUN] Would update ${student.name || student.rollNumber}: ${img.key}`);
        updated++;
        continue;
      }

      try {
        // Store the key (relative path) not full URL - the frontend uses getImageUrl() to build the full URL
        await studentCollection.updateOne(
          { _id: student._id },
          { $set: { profileImage: img.key } }
        );
        log(`  ✓ Updated ${student.name || student.rollNumber}: ${img.key}`, 'SUCCESS');
        updated++;
      } catch (err: any) {
        log(`  ✗ Failed to update ${student.name}: ${err.message}`, 'ERROR');
        errors++;
      }
    }

    logSection('UPDATING STUDENTS FROM OLD-STYLE PATHS');

    // Process old-style images (profile/{rollNumber}_profile.ext)
    for (const [rollNumber, url] of oldStyleImages) {
      const student = studentByRoll.get(rollNumber);

      if (!student) {
        log(`  Student not found for roll: ${rollNumber}`, 'WARN');
        notFound++;
        continue;
      }

      if (student.profileImage) {
        alreadySet++;
        continue;
      }

      // Extract key from URL
      const key = url.replace(`${CONFIG.MINIO_ENDPOINT}/${CONFIG.MINIO_BUCKET}/`, '');

      if (CONFIG.DRY_RUN) {
        log(`  [DRY_RUN] Would update ${student.name || rollNumber}: ${key}`);
        updated++;
        continue;
      }

      try {
        await studentCollection.updateOne(
          { _id: student._id },
          { $set: { profileImage: key } }
        );
        log(`  ✓ Updated ${student.name || rollNumber}: ${key}`, 'SUCCESS');
        updated++;
      } catch (err: any) {
        log(`  ✗ Failed to update ${student.name}: ${err.message}`, 'ERROR');
        errors++;
      }
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logSection('SYNC SUMMARY');
    log(`Duration: ${duration} seconds`);
    log('');
    log(`Students updated: ${updated}`);
    log(`Already had image: ${alreadySet}`);
    log(`Not found in DB: ${notFound}`);
    log(`Errors: ${errors}`);

    if (CONFIG.DRY_RUN) {
      log('');
      log('This was a DRY RUN. No changes were made.', 'WARN');
      log('Run without DRY_RUN=true to apply changes.', 'WARN');
    }

  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
