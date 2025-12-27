/**
 * Data Transformation Script
 * Transforms data from OLD schema to NEW schema
 *
 * Key Changes:
 * 1. User: Add loginCount, hasChangedDefaultPassword (defaults)
 * 2. Student: Rename feeStuctureId -> feeStructureId (typo fix)
 * 3. FacultyVisitLog: Add status, latitude, longitude, visitMonth, visitYear, isMonthlyVisit
 * 4. InternshipApplication: Add reportsGenerated, totalExpectedReports, totalExpectedVisits
 * 5. MonthlyReport: Add dueDate, submissionWindowStart/End, isOverdue, periodStart/EndDate, isPartialMonth, isFinalReport
 * 6. Grievance: Add escalationLevel (MENTOR, PRINCIPAL, STATE_DIRECTORATE)
 * 7. Archive: FCMToken, Event, EventRegistration collections
 */

import { MongoClient, ObjectId, Db } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Stats tracking
interface MigrationStats {
  collection: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

const stats: MigrationStats[] = [];

function createStat(collection: string): MigrationStats {
  const stat: MigrationStats = { collection, total: 0, migrated: 0, skipped: 0, errors: 0 };
  stats.push(stat);
  return stat;
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    success: '\x1b[32m[SUCCESS]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
  }[type];
  console.log(`${prefix} ${message}`);
}

async function transform() {
  // Try multiple connection approaches
  const connectionStrings = [
    process.env.DATABASE_URL!,
    'mongodb://admin:admin123@147.93.106.69:27017/cms_db?authSource=admin',
    'mongodb://admin:admin123@147.93.106.69:27017/cms_db',
    'mongodb://147.93.106.69:27017/cms_db', // No auth
  ];

  let client: MongoClient | null = null;
  let connectedUrl = '';

  for (const url of connectionStrings) {
    log(`Trying: ${url.replace(/:[^:@]+@/, ':***@')}`);
    const tempClient = new MongoClient(url, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    try {
      await tempClient.connect();
      // Test with a simple read operation
      const db = tempClient.db('cms_db');
      await db.collection('User').findOne({});
      client = tempClient;
      connectedUrl = url;
      log('Connected successfully!', 'success');
      break;
    } catch (err: any) {
      log(`Failed: ${err.message}`, 'warn');
      await tempClient.close().catch(() => {});
    }
  }

  if (!client) {
    log('All connection attempts failed!', 'error');
    process.exit(1);
  }

  const db = client.db('cms_db');

  console.log('\n========================================');
  console.log('  DATA TRANSFORMATION - OLD TO NEW SCHEMA');
  console.log('========================================\n');

  try {
    // 1. Migrate Users
    await migrateUsers(db);

    // 2. Migrate Students (fix typo)
    await migrateStudents(db);

    // 3. Migrate Faculty Visit Logs
    await migrateFacultyVisitLogs(db);

    // 4. Migrate Internship Applications
    await migrateInternshipApplications(db);

    // 5. Migrate Monthly Reports
    await migrateMonthlyReports(db);

    // 6. Migrate Grievances
    await migrateGrievances(db);

    // 7. Archive removed collections
    await archiveRemovedCollections(db);

    // Print summary
    printSummary();

    log('\nTransformation completed successfully!', 'success');
  } catch (err: any) {
    log(`Transformation failed: ${err.message}`, 'error');
    console.error(err);
  } finally {
    await client.close();
  }
}

async function migrateUsers(db: Db) {
  const stat = createStat('User');
  const collection = db.collection('User');

  log('1. Migrating Users...');

  const users = await collection.find({}).toArray();
  stat.total = users.length;

  for (const user of users) {
    try {
      const updateFields: Record<string, any> = {};

      // Add new fields if they don't exist
      if (user.loginCount === undefined) updateFields.loginCount = 0;
      if (user.hasChangedDefaultPassword === undefined) updateFields.hasChangedDefaultPassword = false;

      if (Object.keys(updateFields).length > 0) {
        await collection.updateOne({ _id: user._id }, { $set: updateFields });
        stat.migrated++;
      } else {
        stat.skipped++;
      }
    } catch (err: any) {
      stat.errors++;
      log(`  Error migrating user ${user._id}: ${err.message}`, 'error');
    }
  }

  log(`   Users: ${stat.migrated} migrated, ${stat.skipped} already up-to-date, ${stat.errors} errors`);
}

async function migrateStudents(db: Db) {
  const stat = createStat('Student');
  const collection = db.collection('Student');

  log('2. Migrating Students (fixing typo: feeStuctureId -> feeStructureId)...');

  // Find students with the old typo field
  const studentsWithTypo = await collection.find({ feeStuctureId: { $exists: true } }).toArray();
  stat.total = studentsWithTypo.length;

  for (const student of studentsWithTypo) {
    try {
      // Rename the field and remove the old one
      await collection.updateOne(
        { _id: student._id },
        {
          $set: { feeStructureId: student.feeStuctureId },
          $unset: { feeStuctureId: "" }
        }
      );
      stat.migrated++;
    } catch (err: any) {
      stat.errors++;
      log(`  Error migrating student ${student._id}: ${err.message}`, 'error');
    }
  }

  log(`   Students: ${stat.migrated} field renamed, ${stat.errors} errors`);
}

async function migrateFacultyVisitLogs(db: Db) {
  const stat = createStat('FacultyVisitLog');
  const collection = db.collection('faculty_visit_logs');

  log('3. Migrating Faculty Visit Logs (adding new fields)...');

  const visitLogs = await collection.find({}).toArray();
  stat.total = visitLogs.length;

  for (const visitLog of visitLogs) {
    try {
      const updateFields: Record<string, any> = {};

      // Add status field (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED)
      if (visitLog.status === undefined) {
        // If visitDate exists and has observations, it's completed
        if (visitLog.visitDate && (visitLog.studentPerformance || visitLog.workEnvironment)) {
          updateFields.status = 'COMPLETED';
        } else if (visitLog.visitDate) {
          updateFields.status = 'COMPLETED';
        } else {
          updateFields.status = 'SCHEDULED';
        }
      }

      // Add GPS fields
      if (visitLog.latitude === undefined) updateFields.latitude = null;
      if (visitLog.longitude === undefined) updateFields.longitude = null;
      if (visitLog.gpsAccuracy === undefined) updateFields.gpsAccuracy = null;
      if (visitLog.signedDocumentUrl === undefined) updateFields.signedDocumentUrl = null;

      // Add monthly visit tracking fields
      if (visitLog.visitDate && visitLog.visitMonth === undefined) {
        const date = new Date(visitLog.visitDate);
        updateFields.visitMonth = date.getMonth() + 1; // 1-12
        updateFields.visitYear = date.getFullYear();
      }
      if (visitLog.requiredByDate === undefined) updateFields.requiredByDate = null;
      if (visitLog.isMonthlyVisit === undefined) updateFields.isMonthlyVisit = true;

      if (Object.keys(updateFields).length > 0) {
        await collection.updateOne({ _id: visitLog._id }, { $set: updateFields });
        stat.migrated++;
      } else {
        stat.skipped++;
      }
    } catch (err: any) {
      stat.errors++;
      log(`  Error migrating visit log ${visitLog._id}: ${err.message}`, 'error');
    }
  }

  log(`   Faculty Visit Logs: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
}

async function migrateInternshipApplications(db: Db) {
  const stat = createStat('InternshipApplication');
  const collection = db.collection('internship_applications');

  log('4. Migrating Internship Applications (adding report tracking fields)...');

  const applications = await collection.find({}).toArray();
  stat.total = applications.length;

  for (const app of applications) {
    try {
      const updateFields: Record<string, any> = {};

      // Add new report/visit generation tracking fields
      if (app.reportsGenerated === undefined) updateFields.reportsGenerated = false;
      if (app.totalExpectedReports === undefined) updateFields.totalExpectedReports = null;
      if (app.totalExpectedVisits === undefined) updateFields.totalExpectedVisits = null;

      if (Object.keys(updateFields).length > 0) {
        await collection.updateOne({ _id: app._id }, { $set: updateFields });
        stat.migrated++;
      } else {
        stat.skipped++;
      }
    } catch (err: any) {
      stat.errors++;
      log(`  Error migrating application ${app._id}: ${err.message}`, 'error');
    }
  }

  log(`   Internship Applications: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
}

async function migrateMonthlyReports(db: Db) {
  const stat = createStat('MonthlyReport');
  const collection = db.collection('monthly_reports');

  log('5. Migrating Monthly Reports (adding submission window fields)...');

  const reports = await collection.find({}).toArray();
  stat.total = reports.length;

  for (const report of reports) {
    try {
      const updateFields: Record<string, any> = {};

      // Add submission window fields
      if (report.dueDate === undefined) updateFields.dueDate = null;
      if (report.submissionWindowStart === undefined) updateFields.submissionWindowStart = null;
      if (report.submissionWindowEnd === undefined) updateFields.submissionWindowEnd = null;
      if (report.isOverdue === undefined) updateFields.isOverdue = false;

      // Late submission tracking
      if (report.isLateSubmission === undefined) updateFields.isLateSubmission = false;
      if (report.daysLate === undefined) updateFields.daysLate = null;

      // Report period details
      if (report.periodStartDate === undefined) updateFields.periodStartDate = null;
      if (report.periodEndDate === undefined) updateFields.periodEndDate = null;
      if (report.isPartialMonth === undefined) updateFields.isPartialMonth = false;
      if (report.isFinalReport === undefined) updateFields.isFinalReport = false;

      if (Object.keys(updateFields).length > 0) {
        await collection.updateOne({ _id: report._id }, { $set: updateFields });
        stat.migrated++;
      } else {
        stat.skipped++;
      }
    } catch (err: any) {
      stat.errors++;
      log(`  Error migrating report ${report._id}: ${err.message}`, 'error');
    }
  }

  log(`   Monthly Reports: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
}

async function migrateGrievances(db: Db) {
  const stat = createStat('Grievance');
  const grievanceCollection = db.collection('Grievance');
  const historyCollection = db.collection('GrievanceStatusHistory');

  log('6. Migrating Grievances (adding escalationLevel)...');

  const grievances = await grievanceCollection.find({}).toArray();
  stat.total = grievances.length;

  for (const grievance of grievances) {
    try {
      const updateFields: Record<string, any> = {};

      // Determine escalation level based on escalationCount
      if (grievance.escalationLevel === undefined) {
        const escalationCount = grievance.escalationCount ?? 0;
        if (escalationCount >= 2) {
          updateFields.escalationLevel = 'STATE_DIRECTORATE';
        } else if (escalationCount >= 1) {
          updateFields.escalationLevel = 'PRINCIPAL';
        } else {
          updateFields.escalationLevel = 'MENTOR';
        }
      }

      if (Object.keys(updateFields).length > 0) {
        await grievanceCollection.updateOne({ _id: grievance._id }, { $set: updateFields });

        // Create initial status history if it doesn't exist
        const existingHistory = await historyCollection.findOne({ grievanceId: grievance._id });
        if (!existingHistory && grievance.submittedDate) {
          await historyCollection.insertOne({
            _id: new ObjectId(),
            grievanceId: grievance._id,
            fromStatus: null,
            toStatus: grievance.status || 'PENDING',
            changedById: grievance.studentId,
            escalationLevel: updateFields.escalationLevel || grievance.escalationLevel || 'MENTOR',
            escalatedToId: grievance.assignedToId || null,
            remarks: 'Initial submission (migrated from old schema)',
            action: 'SUBMITTED',
            createdAt: new Date(grievance.submittedDate),
          });
        }

        stat.migrated++;
      } else {
        stat.skipped++;
      }
    } catch (err: any) {
      stat.errors++;
      log(`  Error migrating grievance ${grievance._id}: ${err.message}`, 'error');
    }
  }

  log(`   Grievances: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
}

async function archiveRemovedCollections(db: Db) {
  log('7. Archiving removed collections...');

  const collectionsToArchive = ['fcm_tokens', 'Event', 'EventRegistration'];
  const timestamp = Date.now();

  for (const collName of collectionsToArchive) {
    try {
      const collection = db.collection(collName);
      const count = await collection.countDocuments();

      if (count > 0) {
        const newName = `_archived_${collName}_${timestamp}`;
        await collection.rename(newName);
        log(`   Archived ${collName} (${count} documents) -> ${newName}`, 'success');
      } else {
        log(`   ${collName}: Empty or doesn't exist, skipping archive`);
      }
    } catch (err: any) {
      if (err.codeName === 'NamespaceNotFound') {
        log(`   ${collName}: Collection not found, skipping`);
      } else {
        log(`   Error archiving ${collName}: ${err.message}`, 'warn');
      }
    }
  }
}

function printSummary() {
  console.log('\n========================================');
  console.log('  TRANSFORMATION SUMMARY');
  console.log('========================================\n');

  let totalMigrated = 0;
  let totalErrors = 0;

  for (const stat of stats) {
    console.log(`  ${stat.collection}:`);
    console.log(`    Total: ${stat.total}, Migrated: ${stat.migrated}, Skipped: ${stat.skipped}, Errors: ${stat.errors}`);
    totalMigrated += stat.migrated;
    totalErrors += stat.errors;
  }

  console.log('\n  ----------------------------------------');
  console.log(`  Total documents transformed: ${totalMigrated}`);
  console.log(`  Total errors: ${totalErrors}`);
  console.log('========================================\n');
}

// Run the transformation
transform().catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
  console.error(err);
  process.exit(1);
});
