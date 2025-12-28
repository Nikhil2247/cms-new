// /**
//  * =============================================================================
//  * COMPLETE MIGRATION PIPELINE
//  * =============================================================================
//  *
//  * This script performs a complete migration from old MongoDB backup to the new
//  * Prisma schema. It handles:
//  *
//  * 1. Backup Restoration - Restores MongoDB backup with namespace mapping
//  * 2. Data Transformation - Updates data structure to match new schema
//  * 3. Institution Updates - Populates institutions with verified details
//  * 4. Prisma Client Regeneration - Regenerates Prisma client after migration
//  *
//  * PREREQUISITES:
//  * - MongoDB Database Tools installed (mongorestore)
//  * - Node.js and npm installed
//  * - .env file with DATABASE_URL configured
//  *
//  * USAGE:
//  *   npx ts-node scripts/migration-pipeline.ts [backup_file_path]
//  *
//  * EXAMPLE:
//  *   npx ts-node scripts/migration-pipeline.ts "D:/backups/mongodb_backup.gz"
//  *
//  * If no backup file is provided, it will use the default path.
//  *
//  * =============================================================================
//  */

// import { MongoClient, Db, ObjectId } from 'mongodb';
// import { execSync, exec } from 'child_process';
// import * as fs from 'fs';
// import * as path from 'path';
// import * as dotenv from 'dotenv';

// // Load environment variables
// dotenv.config({ path: path.resolve(__dirname, '../.env') });

// // =============================================================================
// // CONFIGURATION
// // =============================================================================

// const CONFIG = {
//   // Database configuration
//   DATABASE_URL: process.env.DATABASE_URL || 'mongodb://admin:Admin%401234@147.93.106.69:27017/cms_db?authSource=admin',

//   // Default backup file path (can be overridden via command line)
//   DEFAULT_BACKUP_PATH: path.resolve(__dirname, '../../prisma backup/mongodb_backup_2025-12-27_03-25-20.gz'),

//   // MongoDB tools path (update if mongorestore is in a custom location)
//   MONGORESTORE_PATHS: [
//     'mongorestore', // System PATH
//     path.resolve(__dirname, '../../mongodb-database-tools-windows-x86_64-100.9.4/bin/mongorestore.exe'),
//     'C:/Program Files/MongoDB/Tools/100/bin/mongorestore.exe',
//   ],

//   // Namespace mapping (old database -> new database)
//   SOURCE_DATABASE: 'internship',
//   TARGET_DATABASE: 'cms_db',

//   // Logging
//   LOG_FILE: path.resolve(__dirname, '../logs/migration-pipeline.log'),

//   // Options
//   DRY_RUN: process.env.DRY_RUN === 'true',
//   SKIP_RESTORE: process.env.SKIP_RESTORE === 'true',
//   SKIP_TRANSFORM: process.env.SKIP_TRANSFORM === 'true',
//   SKIP_INSTITUTIONS: process.env.SKIP_INSTITUTIONS === 'true',
//   SKIP_PRISMA: process.env.SKIP_PRISMA === 'true',
// };

// // =============================================================================
// // LOGGING
// // =============================================================================

// let logStream: fs.WriteStream | null = null;

// function initLogging() {
//   const logsDir = path.dirname(CONFIG.LOG_FILE);
//   if (!fs.existsSync(logsDir)) {
//     fs.mkdirSync(logsDir, { recursive: true });
//   }
//   logStream = fs.createWriteStream(CONFIG.LOG_FILE, { flags: 'a' });
// }

// function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') {
//   const timestamp = new Date().toISOString();
//   const prefix = {
//     'INFO': '\x1b[36m[INFO]\x1b[0m',
//     'WARN': '\x1b[33m[WARN]\x1b[0m',
//     'ERROR': '\x1b[31m[ERROR]\x1b[0m',
//     'SUCCESS': '\x1b[32m[SUCCESS]\x1b[0m',
//   }[level];

//   const logMessage = `[${timestamp}] ${prefix} ${message}`;
//   console.log(logMessage);

//   if (logStream) {
//     logStream.write(`[${timestamp}] [${level}] ${message}\n`);
//   }
// }

// function logSection(title: string) {
//   const separator = '='.repeat(70);
//   log('');
//   log(separator);
//   log(title);
//   log(separator);
// }

// // =============================================================================
// // STEP 1: BACKUP RESTORATION
// // =============================================================================

// function findMongorestore(): string | null {
//   for (const mongorestore of CONFIG.MONGORESTORE_PATHS) {
//     try {
//       if (mongorestore === 'mongorestore') {
//         execSync('mongorestore --version', { stdio: 'pipe' });
//         return mongorestore;
//       } else if (fs.existsSync(mongorestore)) {
//         return mongorestore;
//       }
//     } catch {
//       // Continue to next path
//     }
//   }
//   return null;
// }

// async function restoreBackup(backupFile: string): Promise<boolean> {
//   logSection('STEP 1: BACKUP RESTORATION');

//   if (CONFIG.SKIP_RESTORE) {
//     log('Skipping restore (SKIP_RESTORE=true)', 'WARN');
//     return true;
//   }

//   // Validate backup file
//   if (!fs.existsSync(backupFile)) {
//     log(`Backup file not found: ${backupFile}`, 'ERROR');
//     return false;
//   }

//   log(`Backup file: ${backupFile}`);
//   log(`File size: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB`);

//   // Find mongorestore
//   const mongorestore = findMongorestore();
//   if (!mongorestore) {
//     log('mongorestore not found! Please install MongoDB Database Tools.', 'ERROR');
//     log('Download from: https://www.mongodb.com/try/download/database-tools', 'ERROR');
//     return false;
//   }
//   log(`Using mongorestore: ${mongorestore}`);

//   // Parse DATABASE_URL
//   const dbUrl = CONFIG.DATABASE_URL;
//   if (!dbUrl) {
//     log('DATABASE_URL not configured in .env file', 'ERROR');
//     return false;
//   }

//   // Build mongorestore command
//   // IMPORTANT: Exclude admin database to prevent overwriting admin credentials
//   const command = [
//     `"${mongorestore}"`,
//     `--uri="${dbUrl}"`,
//     `--archive="${backupFile}"`,
//     '--gzip',
//     `--nsInclude="${CONFIG.SOURCE_DATABASE}.*"`,
//     `--nsExclude="admin.*"`,
//     `--nsFrom="${CONFIG.SOURCE_DATABASE}.*"`,
//     `--nsTo="${CONFIG.TARGET_DATABASE}.*"`,
//     '--drop',
//   ].join(' ');

//   log(`Executing: mongorestore with namespace mapping ${CONFIG.SOURCE_DATABASE}.* -> ${CONFIG.TARGET_DATABASE}.*`);
//   log(`  Excluding: admin.* (to preserve admin credentials)`);

//   if (CONFIG.DRY_RUN) {
//     log('DRY_RUN: Would execute mongorestore', 'WARN');
//     return true;
//   }

//   try {
//     const output = execSync(command, {
//       encoding: 'utf-8',
//       stdio: ['pipe', 'pipe', 'pipe'],
//       maxBuffer: 50 * 1024 * 1024 // 50MB buffer
//     });
//     log('Backup restored successfully!', 'SUCCESS');

//     // Log summary if available
//     const docsMatch = output.match(/(\d+) document\(s\) restored/);
//     if (docsMatch) {
//       log(`Documents restored: ${docsMatch[1]}`);
//     }

//     return true;
//   } catch (error: any) {
//     // mongorestore outputs to stderr even on success
//     if (error.stderr && error.stderr.includes('done')) {
//       log('Backup restored successfully!', 'SUCCESS');
//       return true;
//     }
//     log(`Restore failed: ${error.message}`, 'ERROR');
//     if (error.stderr) {
//       log(`stderr: ${error.stderr}`, 'ERROR');
//     }
//     return false;
//   }
// }

// // =============================================================================
// // STEP 2: DATA TRANSFORMATION
// // =============================================================================

// interface MigrationStats {
//   collection: string;
//   total: number;
//   migrated: number;
//   skipped: number;
//   errors: number;
// }

// const stats: MigrationStats[] = [];

// function createStat(collection: string): MigrationStats {
//   const stat: MigrationStats = { collection, total: 0, migrated: 0, skipped: 0, errors: 0 };
//   stats.push(stat);
//   return stat;
// }

// async function transformData(db: Db): Promise<boolean> {
//   logSection('STEP 2: DATA TRANSFORMATION');

//   if (CONFIG.SKIP_TRANSFORM) {
//     log('Skipping transformation (SKIP_TRANSFORM=true)', 'WARN');
//     return true;
//   }

//   try {
//     // Check collections
//     const collections = await db.listCollections().toArray();
//     log(`Found ${collections.length} collections in database`);

//     if (collections.length === 0) {
//       log('Database is empty! Restore backup first.', 'ERROR');
//       return false;
//     }

//     // Run all transformations
//     await migrateUsers(db);
//     await migrateStudents(db);
//     await migrateFacultyVisitLogs(db);
//     await migrateInternshipApplications(db);
//     await migrateMonthlyReports(db);
//     await migrateGrievances(db);
//     await archiveRemovedCollections(db);
//     await addDefaultValues(db);
//     await createIndexes(db);

//     // Print summary
//     printTransformationSummary();

//     return true;
//   } catch (error: any) {
//     log(`Transformation failed: ${error.message}`, 'ERROR');
//     return false;
//   }
// }

// async function migrateUsers(db: Db) {
//   const stat = createStat('User');
//   const collection = db.collection('User');

//   log('Migrating Users...');

//   const users = await collection.find({}).toArray();
//   stat.total = users.length;

//   for (const user of users) {
//     try {
//       const updateFields: any = {};

//       if (user.loginCount === undefined) updateFields.loginCount = 0;
//       if (user.hasChangedDefaultPassword === undefined) updateFields.hasChangedDefaultPassword = false;

//       if (Object.keys(updateFields).length > 0) {
//         if (!CONFIG.DRY_RUN) {
//           await collection.updateOne({ _id: user._id }, { $set: updateFields });
//         }
//         stat.migrated++;
//       } else {
//         stat.skipped++;
//       }
//     } catch (err: any) {
//       stat.errors++;
//     }
//   }

//   log(`  Users: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
// }

// async function migrateStudents(db: Db) {
//   const stat = createStat('Student');
//   const collection = db.collection('Student');

//   log('Migrating Students (fixing typo: feeStuctureId -> feeStructureId)...');

//   const studentsWithTypo = await collection.find({ feeStuctureId: { $exists: true } }).toArray();
//   stat.total = studentsWithTypo.length;

//   for (const student of studentsWithTypo) {
//     try {
//       if (!CONFIG.DRY_RUN) {
//         await collection.updateOne(
//           { _id: student._id },
//           { $rename: { feeStuctureId: 'feeStructureId' } }
//         );
//       }
//       stat.migrated++;
//     } catch (err: any) {
//       stat.errors++;
//     }
//   }

//   log(`  Students: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
// }

// async function migrateFacultyVisitLogs(db: Db) {
//   const stat = createStat('FacultyVisitLog');
//   const collection = db.collection('faculty_visit_logs');

//   log('Migrating Faculty Visit Logs...');

//   const visitLogs = await collection.find({}).toArray();
//   stat.total = visitLogs.length;

//   for (const visitLog of visitLogs) {
//     try {
//       const updateFields: any = {};

//       if (visitLog.status === undefined) {
//         updateFields.status = visitLog.visitDate ? 'COMPLETED' : 'SCHEDULED';
//       }
//       if (visitLog.latitude === undefined) updateFields.latitude = null;
//       if (visitLog.longitude === undefined) updateFields.longitude = null;
//       if (visitLog.visitDate && visitLog.visitMonth === undefined) {
//         const date = new Date(visitLog.visitDate);
//         updateFields.visitMonth = date.getMonth() + 1;
//         updateFields.visitYear = date.getFullYear();
//       }
//       if (visitLog.isMonthlyVisit === undefined) updateFields.isMonthlyVisit = true;

//       if (Object.keys(updateFields).length > 0) {
//         if (!CONFIG.DRY_RUN) {
//           await collection.updateOne({ _id: visitLog._id }, { $set: updateFields });
//         }
//         stat.migrated++;
//       } else {
//         stat.skipped++;
//       }
//     } catch (err: any) {
//       stat.errors++;
//     }
//   }

//   log(`  Faculty Visit Logs: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
// }

// async function migrateInternshipApplications(db: Db) {
//   const stat = createStat('InternshipApplication');
//   const collection = db.collection('internship_applications');

//   log('Migrating Internship Applications...');

//   const applications = await collection.find({}).toArray();
//   stat.total = applications.length;

//   for (const app of applications) {
//     try {
//       const updateFields: any = {};

//       if (app.reportsGenerated === undefined) updateFields.reportsGenerated = false;
//       if (app.totalExpectedReports === undefined) updateFields.totalExpectedReports = null;
//       if (app.totalExpectedVisits === undefined) updateFields.totalExpectedVisits = null;

//       if (Object.keys(updateFields).length > 0) {
//         if (!CONFIG.DRY_RUN) {
//           await collection.updateOne({ _id: app._id }, { $set: updateFields });
//         }
//         stat.migrated++;
//       } else {
//         stat.skipped++;
//       }
//     } catch (err: any) {
//       stat.errors++;
//     }
//   }

//   log(`  Internship Applications: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
// }

// async function migrateMonthlyReports(db: Db) {
//   const stat = createStat('MonthlyReport');
//   const collection = db.collection('monthly_reports');

//   log('Migrating Monthly Reports...');

//   const reports = await collection.find({}).toArray();
//   stat.total = reports.length;

//   for (const report of reports) {
//     try {
//       const updateFields: any = {};

//       if (report.dueDate === undefined) updateFields.dueDate = null;
//       if (report.submissionWindowStart === undefined) updateFields.submissionWindowStart = null;
//       if (report.submissionWindowEnd === undefined) updateFields.submissionWindowEnd = null;
//       if (report.isOverdue === undefined) updateFields.isOverdue = false;
//       if (report.periodStartDate === undefined) updateFields.periodStartDate = null;
//       if (report.periodEndDate === undefined) updateFields.periodEndDate = null;
//       if (report.isPartialMonth === undefined) updateFields.isPartialMonth = false;
//       if (report.isFinalReport === undefined) updateFields.isFinalReport = false;

//       if (Object.keys(updateFields).length > 0) {
//         if (!CONFIG.DRY_RUN) {
//           await collection.updateOne({ _id: report._id }, { $set: updateFields });
//         }
//         stat.migrated++;
//       } else {
//         stat.skipped++;
//       }
//     } catch (err: any) {
//       stat.errors++;
//     }
//   }

//   log(`  Monthly Reports: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
// }

// async function migrateGrievances(db: Db) {
//   const stat = createStat('Grievance');
//   const grievanceCollection = db.collection('Grievance');
//   const historyCollection = db.collection('GrievanceStatusHistory');

//   log('Migrating Grievances...');

//   const grievances = await grievanceCollection.find({}).toArray();
//   stat.total = grievances.length;

//   for (const grievance of grievances) {
//     try {
//       const updateFields: any = {};

//       if (grievance.escalationLevel === undefined) {
//         if (grievance.escalationCount >= 2) {
//           updateFields.escalationLevel = 'STATE_DIRECTORATE';
//         } else if (grievance.escalationCount >= 1) {
//           updateFields.escalationLevel = 'PRINCIPAL';
//         } else {
//           updateFields.escalationLevel = 'MENTOR';
//         }
//       }

//       if (Object.keys(updateFields).length > 0) {
//         if (!CONFIG.DRY_RUN) {
//           await grievanceCollection.updateOne({ _id: grievance._id }, { $set: updateFields });

//           // Create initial status history
//           const existingHistory = await historyCollection.findOne({ grievanceId: grievance._id });
//           if (!existingHistory && grievance.submittedDate) {
//             await historyCollection.insertOne({
//               _id: new ObjectId(),
//               grievanceId: grievance._id,
//               fromStatus: null,
//               toStatus: grievance.status || 'PENDING',
//               changedById: grievance.studentId,
//               escalationLevel: updateFields.escalationLevel || grievance.escalationLevel || 'MENTOR',
//               escalatedToId: grievance.assignedToId || null,
//               remarks: 'Initial submission (migrated)',
//               action: 'SUBMITTED',
//               createdAt: new Date(grievance.submittedDate),
//             });
//           }
//         }
//         stat.migrated++;
//       } else {
//         stat.skipped++;
//       }
//     } catch (err: any) {
//       stat.errors++;
//     }
//   }

//   log(`  Grievances: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
// }

// async function archiveRemovedCollections(db: Db) {
//   log('Archiving removed collections (FCMToken, Event, EventRegistration)...');

//   const collectionsToArchive = ['fcm_tokens', 'Event', 'EventRegistration'];

//   for (const collName of collectionsToArchive) {
//     try {
//       const collection = db.collection(collName);
//       const count = await collection.countDocuments();

//       if (count > 0) {
//         log(`  Found ${count} documents in ${collName}`);
//         if (!CONFIG.DRY_RUN) {
//           const archiveName = `_archived_${collName}_${Date.now()}`;
//           await collection.rename(archiveName);
//           log(`  Archived ${collName} to ${archiveName}`);
//         }
//       }
//     } catch (err: any) {
//       if (err.code !== 26) { // Collection doesn't exist
//         log(`  Error archiving ${collName}: ${err.message}`, 'WARN');
//       }
//     }
//   }
// }

// async function addDefaultValues(db: Db) {
//   log('Adding default values for new fields...');

//   if (CONFIG.DRY_RUN) {
//     log('  DRY_RUN: Would add default values', 'WARN');
//     return;
//   }

//   const updates = [
//     { collection: 'User', filter: { loginCount: { $exists: false } }, update: { $set: { loginCount: 0 } } },
//     { collection: 'User', filter: { hasChangedDefaultPassword: { $exists: false } }, update: { $set: { hasChangedDefaultPassword: false } } },
//     { collection: 'User', filter: { active: { $exists: false } }, update: { $set: { active: true } } },
//     { collection: 'Student', filter: { isActive: { $exists: false } }, update: { $set: { isActive: true } } },
//     { collection: 'Student', filter: { totalBacklogs: { $exists: false } }, update: { $set: { totalBacklogs: 0 } } },
//     { collection: 'Student', filter: { clearanceStatus: { $exists: false } }, update: { $set: { clearanceStatus: 'PENDING' } } },
//     { collection: 'internship_applications', filter: { isSelfIdentified: { $exists: false } }, update: { $set: { isSelfIdentified: false } } },
//     { collection: 'internship_applications', filter: { hasJoined: { $exists: false } }, update: { $set: { hasJoined: false } } },
//     { collection: 'internship_applications', filter: { isSelected: { $exists: false } }, update: { $set: { isSelected: false } } },
//     { collection: 'faculty_visit_logs', filter: { followUpRequired: { $exists: false } }, update: { $set: { followUpRequired: false } } },
//     { collection: 'monthly_reports', filter: { isApproved: { $exists: false } }, update: { $set: { isApproved: false } } },
//     { collection: 'Grievance', filter: { escalationCount: { $exists: false } }, update: { $set: { escalationCount: 0 } } },
//     { collection: 'Grievance', filter: { previousAssignees: { $exists: false } }, update: { $set: { previousAssignees: [] } } },
//     { collection: 'Grievance', filter: { escalationHistory: { $exists: false } }, update: { $set: { escalationHistory: [] } } },
//     { collection: 'industries', filter: { isVerified: { $exists: false } }, update: { $set: { isVerified: false } } },
//     { collection: 'industries', filter: { isApproved: { $exists: false } }, update: { $set: { isApproved: false } } },
//     { collection: 'internships', filter: { isActive: { $exists: false } }, update: { $set: { isActive: true } } },
//     { collection: 'internships', filter: { totalFacultyVisits: { $exists: false } }, update: { $set: { totalFacultyVisits: 4 } } },
//     { collection: 'completion_feedbacks', filter: { isCompleted: { $exists: false } }, update: { $set: { isCompleted: false } } },
//     { collection: 'Notification', filter: { read: { $exists: false } }, update: { $set: { read: false } } },
//     { collection: 'Institution', filter: { isActive: { $exists: false } }, update: { $set: { isActive: true } } },
//     { collection: 'Batch', filter: { isActive: { $exists: false } }, update: { $set: { isActive: true } } },
//     { collection: 'Semester', filter: { isActive: { $exists: false } }, update: { $set: { isActive: true } } },
//     { collection: 'FeeStructure', filter: { isActive: { $exists: false } }, update: { $set: { isActive: true } } },
//     { collection: 'branches', filter: { isActive: { $exists: false } }, update: { $set: { isActive: true } } },
//     { collection: 'departments', filter: { isActive: { $exists: false } }, update: { $set: { isActive: true } } },
//   ];

//   let totalUpdated = 0;
//   for (const { collection: collName, filter, update } of updates) {
//     try {
//       const collection = db.collection(collName);
//       const result = await collection.updateMany(filter, update);
//       totalUpdated += result.modifiedCount;
//     } catch (err: any) {
//       // Collection may not exist
//     }
//   }

//   log(`  Updated ${totalUpdated} documents with default values`);
// }

// async function createIndexes(db: Db) {
//   log('Creating indexes...');

//   if (CONFIG.DRY_RUN) {
//     log('  DRY_RUN: Would create indexes', 'WARN');
//     return;
//   }

//   const indexSpecs = [
//     { collection: 'User', indexes: [{ institutionId: 1 }, { role: 1 }, { active: 1 }] },
//     { collection: 'Student', indexes: [{ institutionId: 1 }, { batchId: 1 }, { branchId: 1 }] },
//     { collection: 'Document', indexes: [{ studentId: 1 }, { type: 1 }] },
//     { collection: 'Notification', indexes: [{ userId: 1 }, { read: 1 }, { createdAt: 1 }] },
//     { collection: 'internship_applications', indexes: [{ studentId: 1 }, { internshipId: 1 }, { status: 1 }] },
//     { collection: 'faculty_visit_logs', indexes: [{ applicationId: 1 }, { visitDate: 1 }] },
//     { collection: 'monthly_reports', indexes: [{ applicationId: 1 }, { studentId: 1 }, { status: 1 }] },
//     { collection: 'Grievance', indexes: [{ studentId: 1 }, { status: 1 }, { escalationLevel: 1 }] },
//     { collection: 'GrievanceStatusHistory', indexes: [{ grievanceId: 1 }] },
//     { collection: 'mentor_assignments', indexes: [{ studentId: 1 }, { mentorId: 1 }, { isActive: 1 }] },
//     { collection: 'industries', indexes: [{ institutionId: 1 }, { isVerified: 1 }] },
//     { collection: 'internships', indexes: [{ industryId: 1 }, { institutionId: 1 }, { isActive: 1 }] },
//   ];

//   let indexCount = 0;
//   for (const { collection: collName, indexes } of indexSpecs) {
//     const collection = db.collection(collName);
//     for (const indexSpec of indexes) {
//       try {
//         await collection.createIndex(indexSpec);
//         indexCount++;
//       } catch (err: any) {
//         // Index may already exist
//       }
//     }
//   }

//   log(`  Created/verified ${indexCount} indexes`);
// }

// function printTransformationSummary() {
//   log('');
//   log('Transformation Summary:');
//   let totalMigrated = 0;
//   let totalErrors = 0;

//   for (const stat of stats) {
//     log(`  ${stat.collection}: ${stat.migrated} migrated, ${stat.skipped} skipped, ${stat.errors} errors`);
//     totalMigrated += stat.migrated;
//     totalErrors += stat.errors;
//   }

//   log(`  Total: ${totalMigrated} documents migrated, ${totalErrors} errors`);
// }

// // =============================================================================
// // STEP 3: INSTITUTION UPDATES
// // =============================================================================

// const INSTITUTION_DATA = [
//   {
//     name: 'S. Amarjit Singh Sahi Government Polytechnic College, Talwara',
//     shortName: 'SASS GPC Talwara',
//     code: 'SASSGPC-TALWARA',
//     address: 'Sector-4, Talwara Township, Tehsil Mukerian',
//     city: 'Talwara',
//     district: 'Hoshiarpur',
//     pinCode: '144216',
//     contactEmail: 'gpctalwara@punjab.gov.in',
//     contactPhone: '01883-238222',
//     alternatePhone: '9501107354',
//     website: 'https://gpctalwara.org.in',
//     establishedYear: 2016
//   },
//   {
//     name: 'Mai Bhago Government Polytechnic College for Girls, Amritsar',
//     shortName: 'GPCG Amritsar',
//     code: 'GPCG-AMRITSAR',
//     address: 'Majitha Road Bypass, Diamond Avenue',
//     city: 'Amritsar',
//     district: 'Amritsar',
//     pinCode: '143001',
//     contactEmail: 'gpcgamritsar@punjab.gov.in',
//     contactPhone: '0183-2421337',
//     alternatePhone: '9914263363',
//     website: 'https://gpcgasr.in',
//     establishedYear: 1970
//   },
//   {
//     name: 'Government Polytechnic College, Batala',
//     shortName: 'GPC Batala',
//     code: 'GPC-BATALA',
//     address: 'Kahnuwan Road, Batala',
//     city: 'Batala',
//     district: 'Gurdaspur',
//     pinCode: '143506',
//     contactEmail: 'principalgpcbatala@gmail.com',
//     contactPhone: '01871-240149',
//     alternatePhone: '01871-225689',
//     website: 'https://www.gpbatala.org',
//     establishedYear: 1964
//   },
//   {
//     name: 'Sant Baba Prem Singh Memorial Government Polytechnic College, Begowal',
//     shortName: 'GPC Begowal',
//     code: 'GPC-BEGOWAL',
//     address: 'VPO Begowal',
//     city: 'Begowal',
//     district: 'Kapurthala',
//     pinCode: '144621',
//     contactEmail: 'gpcbegowal@gmail.com',
//     contactPhone: '01822-248248',
//     website: 'https://www.gpcbegowal.org',
//     establishedYear: 2012
//   },
//   {
//     name: 'Government Polytechnic College, Behram',
//     shortName: 'GPC Behram',
//     code: 'GPC-BEHRAM',
//     address: 'VPO Behram, Tehsil Banga',
//     city: 'Behram',
//     district: 'Shaheed Bhagat Singh Nagar',
//     pinCode: '144503',
//     contactEmail: 'gpcbehram@punjab.gov.in',
//     contactPhone: '01823-500000',
//     website: 'https://www.gpcbehram.ac.in',
//     establishedYear: 2012
//   },
//   {
//     name: 'Government Polytechnic College, Bhikhiwind',
//     shortName: 'GPC Bhikhiwind',
//     code: 'GPC-BHIKHIWIND',
//     address: 'Khemkarn Road, Bhikhiwind',
//     city: 'Bhikhiwind',
//     district: 'Tarn Taran',
//     pinCode: '143303',
//     contactEmail: 'gpcbhikhiwind@punjab.gov.in',
//     contactPhone: '01851-272619',
//     alternatePhone: '9855244399',
//     website: 'https://www.gpcbhikhiwind.org',
//     establishedYear: 1995
//   },
//   {
//     name: 'Government Polytechnic College for Women, Dinanagar',
//     shortName: 'GPCG Dinanagar',
//     code: 'GPCG-DINANAGAR',
//     address: 'Behrampur-Dinanagar Road, Village Dodwan',
//     city: 'Dinanagar',
//     district: 'Gurdaspur',
//     pinCode: '143531',
//     contactEmail: 'gpcgdinanagar@punjab.gov.in',
//     contactPhone: '01871-500000',
//     establishedYear: 2005
//   },
//   {
//     name: 'Government Polytechnic College, Fatuhikhera',
//     shortName: 'GPC Fatuhikhera',
//     code: 'GPC-FATUHIKHERA',
//     address: 'Village Fatuhi Khera, P.O. Lambi, Tehsil Malout',
//     city: 'Lambi',
//     district: 'Sri Muktsar Sahib',
//     pinCode: '152113',
//     contactEmail: 'gpcfatuhikhera@punjab.gov.in',
//     contactPhone: '01637-500000',
//     website: 'https://www.gpcfatuhikhera.in',
//     establishedYear: 2012
//   },
//   {
//     name: 'Government Polytechnic College, Ferozepur',
//     shortName: 'GPC Ferozepur',
//     code: 'GPC-FEROZEPUR',
//     address: 'Dulchi Ke Road, Ferozepur City',
//     city: 'Ferozepur',
//     district: 'Ferozepur',
//     pinCode: '152002',
//     contactEmail: 'gpfzr-dteitpb@punjabmail.gov.in',
//     contactPhone: '01632-225414',
//     alternatePhone: '01632-222037',
//     website: 'https://www.gpcfzr.in',
//     establishedYear: 1990
//   },
//   {
//     name: 'Government Polytechnic College, GTB Garh',
//     shortName: 'GPC GTB Garh',
//     code: 'GPC-GTBGARH',
//     address: 'VPO GTB Garh, Tehsil Baghapurana, Moga to Kotakpura Road',
//     city: 'GTB Garh',
//     district: 'Moga',
//     pinCode: '142038',
//     contactEmail: 'gpcgtbgarh@punjab.gov.in',
//     contactPhone: '01636-280735',
//     website: 'https://www.gpcgtbgarh.org',
//     establishedYear: 1963
//   },
//   {
//     name: 'Pandit Jagat Ram Government Polytechnic College, Hoshiarpur',
//     shortName: 'PJRGPC Hoshiarpur',
//     code: 'PJRGPC-HOSHIARPUR',
//     address: 'Jalandhar Road, Near Piplanwala',
//     city: 'Hoshiarpur',
//     district: 'Hoshiarpur',
//     pinCode: '146001',
//     contactEmail: 'ptjrgph@gmail.com',
//     contactPhone: '01882-252387',
//     alternatePhone: '9417412446',
//     website: 'https://www.ptjrgph.com',
//     establishedYear: 1994
//   },
//   {
//     name: 'Government Polytechnic College for Girls, Jalandhar',
//     shortName: 'GPCG Jalandhar',
//     code: 'GPCG-JALANDHAR',
//     address: 'Ladowali Road, Near Railway Crossing, Preet Nagar',
//     city: 'Jalandhar',
//     district: 'Jalandhar',
//     pinCode: '144001',
//     contactEmail: 'gpcgjalandhar@punjab.gov.in',
//     contactPhone: '0181-2457192',
//     alternatePhone: '6280931560',
//     website: 'https://www.gpcgjal.in',
//     establishedYear: 1970
//   },
//   {
//     name: 'Government Polytechnic College, Mohali (Khunimajra)',
//     shortName: 'GPC Mohali',
//     code: 'GPC-MOHALI',
//     address: 'Kharar-Landran Road, Khunimajra',
//     city: 'Mohali',
//     district: 'S.A.S. Nagar',
//     pinCode: '140301',
//     contactEmail: 'gpckhunimajra@punjab.gov.in',
//     contactPhone: '01602920188',
//     alternatePhone: '9814043239',
//     website: 'https://gpckhunimajramohali.org',
//     establishedYear: 1996
//   },
//   {
//     name: 'Government Polytechnic College, Kotkapura',
//     shortName: 'GPC Kotkapura',
//     code: 'GPC-KOTKAPURA',
//     address: 'Devi Wala Road, Near Fun Plaza Multiplex, Kotkapura-Moga Highway',
//     city: 'Kotkapura',
//     district: 'Faridkot',
//     pinCode: '151204',
//     contactEmail: 'gpckotkapura@punjab.gov.in',
//     contactPhone: '01635-222880',
//     alternatePhone: '9501100063',
//     website: 'https://www.gpckotkapura.com',
//     establishedYear: 2012
//   },
//   {
//     name: 'Government Polytechnic College, Patiala',
//     shortName: 'GPC Patiala',
//     code: 'GPC-PATIALA',
//     address: 'SST Nagar, Rajpura Road',
//     city: 'Patiala',
//     district: 'Patiala',
//     pinCode: '147003',
//     contactEmail: 'gpcpatiala@punjab.gov.in',
//     contactPhone: '0175-2370158',
//     alternatePhone: '9915776350',
//     website: 'https://gpcpatiala.edu.in',
//     establishedYear: 1991
//   },
//   {
//     name: 'Shri Guru Hargobind Sahib Government Polytechnic College, Ranwan',
//     shortName: 'SGHSGPC Ranwan',
//     code: 'SGHSGPC-RANWAN',
//     address: 'VPO Ranwan, Chandigarh-Ludhiana Highway, Near Khamano',
//     city: 'Ranwan',
//     district: 'Fatehgarh Sahib',
//     pinCode: '140802',
//     contactEmail: 'gpcranwan@punjab.gov.in',
//     contactPhone: '01628-260101',
//     alternatePhone: '9888486201',
//     website: 'https://www.gpcranwan.ac.in',
//     establishedYear: 2012
//   },
//   {
//     name: 'Government Polytechnic College for Girls, Ropar',
//     shortName: 'GPCG Ropar',
//     code: 'GPCG-ROPAR',
//     address: 'Nangal Road',
//     city: 'Ropar',
//     district: 'Rupnagar',
//     pinCode: '140001',
//     contactEmail: 'gpcgropar@punjab.gov.in',
//     contactPhone: '01881-500000',
//     website: 'https://www.gpcrupnagar.ac.in',
//     establishedYear: 1995
//   },
//   {
//     name: 'Government Polytechnic College, Amritsar',
//     shortName: 'GPC Amritsar',
//     code: 'GPC-AMRITSAR',
//     address: 'PO-Rayon & Silk Mill, Near GNDU, GT Road Chheharta',
//     city: 'Amritsar',
//     district: 'Amritsar',
//     pinCode: '143105',
//     contactEmail: 'gpasr68@gmail.com',
//     contactPhone: '0183-2258269',
//     website: 'https://www.gpamritsar.org',
//     establishedYear: 1965
//   },
//   {
//     name: 'Shaheed Nand Singh Government Polytechnic College, Bareta',
//     shortName: 'SNSGPC Bareta',
//     code: 'SNSGPC-BARETA',
//     address: 'Near Veterinary Hospital, Back Side New M.C Office',
//     city: 'Bareta',
//     district: 'Mansa',
//     pinCode: '151501',
//     contactEmail: 'gpcbareta@punjab.gov.in',
//     contactPhone: '01652-500000',
//     alternatePhone: '9023077730',
//     website: 'https://snsgpcbareta.org',
//     establishedYear: 2012
//   },
//   {
//     name: 'Government Polytechnic College, Bathinda',
//     shortName: 'GPC Bathinda',
//     code: 'GPC-BATHINDA',
//     address: 'Bibiwala Road',
//     city: 'Bathinda',
//     district: 'Bathinda',
//     pinCode: '151001',
//     contactEmail: 'rupinder.chahal@punjab.gov.in',
//     contactPhone: '0164-2246394',
//     alternatePhone: '9316906633',
//     website: 'https://gpcbathinda.ac.in',
//     establishedYear: 1985
//   },
//   {
//     name: 'Sant Baba Attar Singh Government Polytechnic College, Badbar',
//     shortName: 'SBASGPC Badbar',
//     code: 'SBASGPC-BADBAR',
//     address: 'Main Barnala-Sangrur Road, Badbar',
//     city: 'Badbar',
//     district: 'Barnala',
//     pinCode: '148106',
//     contactEmail: 'gpcbadbar@punjab.gov.in',
//     contactPhone: '01679-268011',
//     website: 'https://gpcbadbar.org.in',
//     establishedYear: 2012
//   },
//   {
//     name: 'Satguru Ram Singh Government Polytechnic College for Girls, Ludhiana',
//     shortName: 'SRSGPCG Ludhiana',
//     code: 'SRSGPCG-LUDHIANA',
//     address: 'Rishi Nagar, Ludhiana-Humbran Road',
//     city: 'Ludhiana',
//     district: 'Ludhiana',
//     pinCode: '141001',
//     contactEmail: 'principalgpcgldh@yahoo.com',
//     contactPhone: '0161-2303223',
//     website: 'https://www.gpcgldh.ac.in',
//     establishedYear: 1995
//   },
//   {
//     name: 'Government Institute of Leather and Footwear Technology, Jalandhar',
//     shortName: 'GILFT Jalandhar',
//     code: 'GILFT-JALANDHAR',
//     address: 'Opposite Dr. B.R. Ambedkar Bhawan, Near Guru Ravidass Chowk, Nakodar Road',
//     city: 'Jalandhar',
//     district: 'Jalandhar',
//     pinCode: '144003',
//     contactEmail: 'gilftjalandhar@punjab.gov.in',
//     contactPhone: '0181-2450000',
//     website: 'https://www.gilftjal.org',
//     establishedYear: 1934
//   }
// ];

// async function updateInstitutions(db: Db): Promise<boolean> {
//   logSection('STEP 3: INSTITUTION UPDATES');

//   if (CONFIG.SKIP_INSTITUTIONS) {
//     log('Skipping institution updates (SKIP_INSTITUTIONS=true)', 'WARN');
//     return true;
//   }

//   const collection = db.collection('Institution');
//   let updated = 0;
//   let inserted = 0;

//   log(`Processing ${INSTITUTION_DATA.length} institution records...`);

//   for (const inst of INSTITUTION_DATA) {
//     try {
//       // Try to find existing institution by short name pattern or city
//       const existing = await collection.findOne({
//         $or: [
//           { shortName: { $regex: inst.shortName.split(' ')[1] || inst.shortName, $options: 'i' } },
//           { name: { $regex: inst.city, $options: 'i' } },
//           { code: inst.code }
//         ]
//       });

//       const updateData = {
//         name: inst.name,
//         shortName: inst.shortName,
//         code: inst.code,
//         type: 'POLYTECHNIC',
//         address: inst.address,
//         city: inst.city,
//         district: inst.district,
//         state: 'Punjab',
//         pinCode: inst.pinCode,
//         country: 'India',
//         contactEmail: inst.contactEmail,
//         contactPhone: inst.contactPhone,
//         alternatePhone: inst.alternatePhone || null,
//         website: inst.website || null,
//         establishedYear: inst.establishedYear || null,
//         affiliatedTo: 'PSBTE & IT, Chandigarh',
//         recognizedBy: 'AICTE',
//         isActive: true,
//         updatedAt: new Date()
//       };

//       if (existing) {
//         if (!CONFIG.DRY_RUN) {
//           await collection.updateOne({ _id: existing._id }, { $set: updateData });
//         }
//         updated++;
//       } else {
//         // Check if we should insert
//         const existsByCode = await collection.findOne({ code: inst.code });
//         if (!existsByCode && !CONFIG.DRY_RUN) {
//           await collection.insertOne({
//             ...updateData,
//             createdAt: new Date()
//           });
//           inserted++;
//         }
//       }
//     } catch (err: any) {
//       log(`  Error processing ${inst.name}: ${err.message}`, 'WARN');
//     }
//   }

//   log(`  Updated: ${updated} institutions`);
//   log(`  Inserted: ${inserted} new institutions`);

//   return true;
// }

// // =============================================================================
// // STEP 4: PRISMA CLIENT REGENERATION
// // =============================================================================

// async function regeneratePrismaClient(): Promise<boolean> {
//   logSection('STEP 4: PRISMA CLIENT REGENERATION');

//   if (CONFIG.SKIP_PRISMA) {
//     log('Skipping Prisma regeneration (SKIP_PRISMA=true)', 'WARN');
//     return true;
//   }

//   if (CONFIG.DRY_RUN) {
//     log('DRY_RUN: Would run prisma generate', 'WARN');
//     return true;
//   }

//   try {
//     log('Running: npx prisma generate');
//     const backendDir = path.resolve(__dirname, '..');
//     execSync('npx prisma generate', {
//       cwd: backendDir,
//       encoding: 'utf-8',
//       stdio: 'inherit'
//     });
//     log('Prisma client regenerated successfully!', 'SUCCESS');
//     return true;
//   } catch (error: any) {
//     log(`Prisma generate failed: ${error.message}`, 'ERROR');
//     return false;
//   }
// }

// // =============================================================================
// // MAIN PIPELINE
// // =============================================================================

// async function runPipeline() {
//   const startTime = Date.now();

//   // Initialize logging
//   initLogging();

//   logSection('MIGRATION PIPELINE STARTED');
//   log(`Timestamp: ${new Date().toISOString()}`);
//   log(`DRY_RUN: ${CONFIG.DRY_RUN}`);

//   // Get backup file path
//   const backupFile = process.argv[2] || CONFIG.DEFAULT_BACKUP_PATH;
//   log(`Backup file: ${backupFile}`);
//   log(`Database: ${CONFIG.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

//   // Step 1: Restore Backup
//   const restoreSuccess = await restoreBackup(backupFile);
//   if (!restoreSuccess && !CONFIG.SKIP_RESTORE) {
//     log('Pipeline aborted due to restore failure', 'ERROR');
//     process.exit(1);
//   }

//   // Connect to database for remaining steps
//   const client = new MongoClient(CONFIG.DATABASE_URL);

//   try {
//     await client.connect();
//     log('Connected to MongoDB');

//     const db = client.db();

//     // Step 2: Transform Data
//     const transformSuccess = await transformData(db);
//     if (!transformSuccess && !CONFIG.SKIP_TRANSFORM) {
//       log('Pipeline aborted due to transformation failure', 'ERROR');
//       process.exit(1);
//     }

//     // Step 3: Update Institutions
//     const institutionSuccess = await updateInstitutions(db);
//     if (!institutionSuccess && !CONFIG.SKIP_INSTITUTIONS) {
//       log('Pipeline aborted due to institution update failure', 'ERROR');
//       process.exit(1);
//     }

//   } finally {
//     await client.close();
//   }

//   // Step 4: Regenerate Prisma Client
//   const prismaSuccess = await regeneratePrismaClient();
//   if (!prismaSuccess && !CONFIG.SKIP_PRISMA) {
//     log('Pipeline completed with Prisma regeneration warning', 'WARN');
//   }

//   // Final summary
//   const duration = ((Date.now() - startTime) / 1000).toFixed(2);

//   logSection('MIGRATION PIPELINE COMPLETED');
//   log(`Total duration: ${duration} seconds`);
//   log(`Log file: ${CONFIG.LOG_FILE}`);
//   log('', 'SUCCESS');
//   log('Next steps:', 'SUCCESS');
//   log('  1. Verify the data in your application', 'SUCCESS');
//   log('  2. Test all functionality', 'SUCCESS');
//   log('  3. Check the log file for any warnings', 'SUCCESS');

//   if (logStream) {
//     logStream.end();
//   }
// }

// // Run the pipeline
// runPipeline().catch((error) => {
//   console.error('Pipeline failed:', error);
//   process.exit(1);
// });
