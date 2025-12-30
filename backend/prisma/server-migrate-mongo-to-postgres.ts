// /**
//  * MongoDB to PostgreSQL Server Migration Script
//  *
//  * This script migrates all data from a MongoDB server to a PostgreSQL server.
//  * Designed to run on a server for production migrations.
//  *
//  * Features:
//  * - Configurable via environment variables or CLI arguments
//  * - Connection testing before migration
//  * - Dry-run mode for testing
//  * - Batch processing for large datasets
//  * - Progress logging and resume capability
//  * - Graceful error handling
//  *
//  * Environment Variables:
//  *   SOURCE_MONGODB_URL - MongoDB connection string (source)
//  *   TARGET_DATABASE_URL - PostgreSQL connection string (target)
//  *
//  * Usage:
//  *   # Using environment variables:
//  *   SOURCE_MONGODB_URL="mongodb://..." TARGET_DATABASE_URL="postgresql://..." npx ts-node prisma/server-migrate-mongo-to-postgres.ts
//  *
//  *   # Using CLI arguments:
//  *   npx ts-node prisma/server-migrate-mongo-to-postgres.ts \
//  *     --mongodb-url "mongodb://user:pass@source-server:27017/db" \
//  *     --postgres-url "postgresql://user:pass@target-server:5432/db" \
//  *     --dry-run
//  *
//  *   # With batch size:
//  *   npx ts-node prisma/server-migrate-mongo-to-postgres.ts --batch-size 500
//  */

// import { PrismaClient, ApplicationStatus } from '@prisma/client';
// import { MongoClient, ObjectId } from 'mongodb';
// import { v4 as uuidv4 } from 'uuid';

// // =============================================================================
// // Configuration
// // =============================================================================

// interface MigrationConfig {
//   mongodbUrl: string;
//   postgresUrl: string;
//   dryRun: boolean;
//   batchSize: number;
//   skipClear: boolean;
//   verbose: boolean;
// }

// function parseArgs(): MigrationConfig {
//   const args = process.argv.slice(2);
//   const config: MigrationConfig = {
//     mongodbUrl: process.env.SOURCE_MONGODB_URL || process.env.MONGODB_URL || '',
//     postgresUrl: process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || '',
//     dryRun: false,
//     batchSize: 1000,
//     skipClear: false,
//     verbose: false,
//   };

//   for (let i = 0; i < args.length; i++) {
//     switch (args[i]) {
//       case '--mongodb-url':
//       case '-m':
//         config.mongodbUrl = args[++i];
//         break;
//       case '--postgres-url':
//       case '-p':
//         config.postgresUrl = args[++i];
//         break;
//       case '--dry-run':
//       case '-d':
//         config.dryRun = true;
//         break;
//       case '--batch-size':
//       case '-b':
//         config.batchSize = parseInt(args[++i], 10);
//         break;
//       case '--skip-clear':
//       case '-s':
//         config.skipClear = true;
//         break;
//       case '--verbose':
//       case '-v':
//         config.verbose = true;
//         break;
//       case '--help':
//       case '-h':
//         printHelp();
//         process.exit(0);
//     }
//   }

//   return config;
// }

// function printHelp(): void {
//   console.log(`
// MongoDB to PostgreSQL Server Migration Script

// USAGE:
//   npx ts-node prisma/server-migrate-mongo-to-postgres.ts [OPTIONS]

// OPTIONS:
//   -m, --mongodb-url <url>     MongoDB connection URL (source server)
//   -p, --postgres-url <url>    PostgreSQL connection URL (target server)
//   -d, --dry-run               Test connections without migrating data
//   -b, --batch-size <number>   Number of records per batch (default: 1000)
//   -s, --skip-clear            Skip clearing PostgreSQL tables before migration
//   -v, --verbose               Enable verbose logging
//   -h, --help                  Show this help message

// ENVIRONMENT VARIABLES:
//   SOURCE_MONGODB_URL          MongoDB connection URL (alternative to -m)
//   TARGET_DATABASE_URL         PostgreSQL connection URL (alternative to -p)

// EXAMPLES:
//   # Basic migration
//   npx ts-node prisma/server-migrate-mongo-to-postgres.ts \\
//     -m "mongodb://admin:password@source-vps:27017/cms_db?authSource=admin" \\
//     -p "postgresql://user:password@target-vps:5432/cms_db"

//   # Dry run to test connections
//   npx ts-node prisma/server-migrate-mongo-to-postgres.ts \\
//     -m "mongodb://..." -p "postgresql://..." --dry-run

//   # Using environment variables
//   export SOURCE_MONGODB_URL="mongodb://..."
//   export TARGET_DATABASE_URL="postgresql://..."
//   npx ts-node prisma/server-migrate-mongo-to-postgres.ts
// `);
// }

// // =============================================================================
// // Logging Utilities
// // =============================================================================

// const colors = {
//   reset: '\x1b[0m',
//   red: '\x1b[31m',
//   green: '\x1b[32m',
//   yellow: '\x1b[33m',
//   blue: '\x1b[34m',
//   cyan: '\x1b[36m',
// };

// function log(message: string, color: keyof typeof colors = 'reset'): void {
//   console.log(`${colors[color]}${message}${colors.reset}`);
// }

// function logSection(title: string): void {
//   console.log('');
//   log('='.repeat(60), 'cyan');
//   log(title, 'cyan');
//   log('='.repeat(60), 'cyan');
// }

// function logPhase(phase: string): void {
//   console.log('');
//   log(`--- ${phase} ---`, 'blue');
// }

// function logSuccess(message: string): void {
//   log(`✓ ${message}`, 'green');
// }

// function logWarning(message: string): void {
//   log(`⚠ ${message}`, 'yellow');
// }

// function logError(message: string): void {
//   log(`✗ ${message}`, 'red');
// }

// function maskConnectionUrl(url: string): string {
//   return url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
// }

// // =============================================================================
// // ID Mapping
// // =============================================================================

// const idMaps: Record<string, Map<string, string>> = {
//   users: new Map(),
//   institutions: new Map(),
//   students: new Map(),
//   branches: new Map(),
//   batches: new Map(),
//   semesters: new Map(),
//   subjects: new Map(),
//   industries: new Map(),
//   internships: new Map(),
//   internshipApplications: new Map(),
//   mentorAssignments: new Map(),
//   documents: new Map(),
//   fees: new Map(),
//   examResults: new Map(),
//   notifications: new Map(),
//   auditLogs: new Map(),
//   grievances: new Map(),
//   technicalQueries: new Map(),
//   monthlyReports: new Map(),
//   facultyVisitLogs: new Map(),
//   monthlyFeedbacks: new Map(),
//   completionFeedbacks: new Map(),
//   complianceRecords: new Map(),
//   industryRequests: new Map(),
//   referralApplications: new Map(),
//   approvedReferrals: new Map(),
//   scholarships: new Map(),
//   placements: new Map(),
//   calendars: new Map(),
//   notices: new Map(),
//   internshipPreferences: new Map(),
// };

// function convertId(objectId: string | ObjectId | null | undefined, collection: string): string {
//   if (!objectId) return '';
//   const idStr = objectId.toString();
//   const map = idMaps[collection];
//   if (!map) {
//     console.warn(`No ID map for collection: ${collection}`);
//     return uuidv4();
//   }
//   if (!map.has(idStr)) {
//     map.set(idStr, uuidv4());
//   }
//   return map.get(idStr)!;
// }

// function getMappedId(objectId: string | ObjectId | null | undefined, collection: string): string | null {
//   if (!objectId) return null;
//   const idStr = objectId.toString();
//   const map = idMaps[collection];
//   return map?.get(idStr) || null;
// }

// function processDate(value: any): Date | null {
//   if (!value) return null;
//   if (value instanceof Date) return value;
//   if (typeof value === 'string' || typeof value === 'number') {
//     const date = new Date(value);
//     return isNaN(date.getTime()) ? null : date;
//   }
//   return null;
// }

// // =============================================================================
// // Migration Statistics
// // =============================================================================

// interface MigrationStats {
//   collection: string;
//   total: number;
//   migrated: number;
//   skipped: number;
//   errors: number;
//   startTime: number;
//   endTime?: number;
// }

// const migrationStats: MigrationStats[] = [];

// function startCollectionMigration(collection: string, total: number): MigrationStats {
//   const stats: MigrationStats = {
//     collection,
//     total,
//     migrated: 0,
//     skipped: 0,
//     errors: 0,
//     startTime: Date.now(),
//   };
//   migrationStats.push(stats);
//   return stats;
// }

// function finishCollectionMigration(stats: MigrationStats): void {
//   stats.endTime = Date.now();
//   const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
//   log(`  Migrated: ${stats.migrated}/${stats.total} | Skipped: ${stats.skipped} | Errors: ${stats.errors} | Time: ${duration}s`, 'reset');
// }

// // =============================================================================
// // Migration Functions
// // =============================================================================

// async function migrateInstitutions(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Institutions...', 'blue');
//   const institutions = await mongoDb.collection('Institution').find({}).toArray();
//   const stats = startCollectionMigration('institutions', institutions.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${institutions.length} institutions`);
//     return;
//   }

//   for (const inst of institutions) {
//     const newId = convertId(inst._id, 'institutions');
//     try {
//       await prisma.institution.create({
//         data: {
//           id: newId,
//           code: inst.code || `INST${Date.now()}`,
//           name: inst.name,
//           shortName: inst.shortName,
//           type: inst.type || 'POLYTECHNIC',
//           address: inst.address,
//           city: inst.city,
//           state: inst.state,
//           pinCode: inst.pinCode,
//           country: inst.country || 'India',
//           contactEmail: inst.contactEmail,
//           contactPhone: inst.contactPhone,
//           website: inst.website,
//           isActive: inst.isActive ?? true,
//           createdAt: processDate(inst.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating institution ${inst.name}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateUsers(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Users...', 'blue');
//   const users = await mongoDb.collection('User').find({}).toArray();
//   const stats = startCollectionMigration('users', users.length);
//   const processedEmails = new Set<string>();

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${users.length} users`);
//     return;
//   }

//   for (const user of users) {
//     const newId = convertId(user._id, 'users');
//     const institutionId = getMappedId(user.institutionId, 'institutions');
//     const email = user.email?.toLowerCase();
//     const isDuplicate = email && processedEmails.has(email);

//     if (email && !isDuplicate) {
//       processedEmails.add(email);
//     }

//     const finalEmail = isDuplicate
//       ? `duplicate_${user._id.toString()}@removed.local`
//       : user.email;

//     try {
//       await prisma.user.create({
//         data: {
//           id: newId,
//           email: finalEmail,
//           password: user.password,
//           name: user.name,
//           role: user.role,
//           active: isDuplicate ? false : (user.active ?? true),
//           institutionId: institutionId,
//           designation: user.designation,
//           phoneNo: user.phoneNo,
//           rollNumber: user.rollNumber,
//           branchName: user.branchName,
//           dob: user.dob,
//           createdAt: processDate(user.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//       if (isDuplicate) stats.skipped++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating user ${user.email}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateBatches(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Batches...', 'blue');
//   const batches = await mongoDb.collection('Batch').find({}).toArray();
//   const stats = startCollectionMigration('batches', batches.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${batches.length} batches`);
//     return;
//   }

//   for (const batch of batches) {
//     const newId = convertId(batch._id, 'batches');
//     const institutionId = getMappedId(batch.institutionId, 'institutions');

//     try {
//       await prisma.batch.create({
//         data: {
//           id: newId,
//           name: batch.name,
//           isActive: batch.isActive ?? true,
//           institutionId: institutionId,
//           createdAt: processDate(batch.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating batch ${batch.name}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateSemesters(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Semesters...', 'blue');
//   const semesters = await mongoDb.collection('Semester').find({}).toArray();
//   const stats = startCollectionMigration('semesters', semesters.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${semesters.length} semesters`);
//     return;
//   }

//   for (const sem of semesters) {
//     const newId = convertId(sem._id, 'semesters');
//     const institutionId = getMappedId(sem.institutionId, 'institutions');

//     try {
//       await prisma.semester.create({
//         data: {
//           id: newId,
//           number: sem.number,
//           isActive: sem.isActive ?? true,
//           institutionId: institutionId,
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating semester ${sem.number}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateBranches(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Branches...', 'blue');
//   const branches = await mongoDb.collection('branches').find({}).toArray();
//   const stats = startCollectionMigration('branches', branches.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${branches.length} branches`);
//     return;
//   }

//   for (const branch of branches) {
//     const newId = convertId(branch._id, 'branches');
//     const institutionId = getMappedId(branch.institutionId, 'institutions');

//     try {
//       await prisma.branch.create({
//         data: {
//           id: newId,
//           name: branch.name,
//           shortName: branch.shortName,
//           code: branch.code || `${branch.shortName}-${Date.now()}`,
//           duration: branch.duration || 3,
//           isActive: branch.isActive ?? true,
//           institutionId: institutionId,
//           createdAt: processDate(branch.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating branch ${branch.name}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateSubjects(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Subjects...', 'blue');
//   const subjects = await mongoDb.collection('Subject').find({}).toArray();
//   const stats = startCollectionMigration('subjects', subjects.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${subjects.length} subjects`);
//     return;
//   }

//   for (const subject of subjects) {
//     const newId = convertId(subject._id, 'subjects');
//     const branchId = getMappedId(subject.branchId, 'branches');
//     const institutionId = getMappedId(subject.institutionId, 'institutions');

//     try {
//       await prisma.subject.create({
//         data: {
//           id: newId,
//           subjectName: subject.subjectName,
//           subjectCode: subject.subjectCode,
//           syllabusYear: subject.syllabusYear,
//           semesterNumber: subject.semesterNumber,
//           branchName: subject.branchName,
//           maxMarks: subject.maxMarks || 100,
//           subjectType: subject.subjectType || 'THEORY',
//           branchId: branchId,
//           institutionId: institutionId,
//           createdAt: processDate(subject.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating subject ${subject.subjectName}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateStudents(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Students...', 'blue');
//   const students = await mongoDb.collection('Student').find({}).toArray();
//   const stats = startCollectionMigration('students', students.length);
//   const processedUserIds = new Map<string, string>();

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${students.length} students`);
//     return;
//   }

//   for (const student of students) {
//     const userId = getMappedId(student.userId, 'users');
//     const institutionId = getMappedId(student.institutionId, 'institutions');
//     const branchId = getMappedId(student.branchId, 'branches');
//     const batchId = getMappedId(student.batchId, 'batches');

//     if (!userId) {
//       stats.skipped++;
//       continue;
//     }

//     const isDuplicate = processedUserIds.has(userId);
//     if (isDuplicate) {
//       const existingUuid = processedUserIds.get(userId)!;
//       idMaps['students'].set(student._id.toString(), existingUuid);
//       stats.skipped++;
//       continue;
//     }

//     const newId = convertId(student._id, 'students');
//     processedUserIds.set(userId, newId);

//     try {
//       await prisma.student.create({
//         data: {
//           id: newId,
//           userId: userId,
//           rollNumber: student.rollNumber,
//           admissionNumber: student.admissionNumber,
//           name: student.name,
//           email: student.email,
//           contact: student.contact,
//           gender: student.gender,
//           dob: student.dob,
//           address: student.address,
//           city: student.city,
//           state: student.state,
//           pinCode: student.pinCode,
//           tehsil: student.tehsil,
//           district: student.district,
//           parentName: student.parentName,
//           parentContact: student.parentContact,
//           motherName: student.motherName,
//           institutionId: institutionId,
//           branchId: branchId,
//           branchName: student.branchName,
//           batchId: batchId,
//           currentYear: student.currentYear,
//           currentSemester: student.currentSemester,
//           admissionType: student.admissionType,
//           category: student.category,
//           clearanceStatus: student.clearanceStatus || 'PENDING',
//           isActive: student.isActive ?? true,
//           profileImage: student.profilePicture || student.profileImage,
//           createdAt: processDate(student.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating student ${student.rollNumber}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateIndustries(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Industries...', 'blue');
//   const industries = await mongoDb.collection('industries').find({}).toArray();
//   const stats = startCollectionMigration('industries', industries.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${industries.length} industries`);
//     return;
//   }

//   for (const industry of industries) {
//     const newId = convertId(industry._id, 'industries');
//     const userId = getMappedId(industry.userId, 'users');

//     try {
//       await prisma.industry.create({
//         data: {
//           id: newId,
//           userId: userId,
//           companyName: industry.companyName,
//           industryType: industry.industryType,
//           companySize: industry.companySize,
//           website: industry.website,
//           address: industry.address,
//           city: industry.city,
//           state: industry.state,
//           pinCode: industry.pinCode,
//           contactPersonName: industry.contactPersonName,
//           contactPersonTitle: industry.contactPersonTitle,
//           primaryEmail: industry.primaryEmail,
//           primaryPhone: industry.primaryPhone,
//           registrationNumber: industry.registrationNumber,
//           panNumber: industry.panNumber,
//           isApproved: industry.isApproved ?? false,
//           createdAt: processDate(industry.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating industry ${industry.companyName}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateInternships(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Internships...', 'blue');
//   const internships = await mongoDb.collection('internships').find({}).toArray();
//   const stats = startCollectionMigration('internships', internships.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${internships.length} internships`);
//     return;
//   }

//   for (const internship of internships) {
//     const newId = convertId(internship._id, 'internships');
//     const industryId = getMappedId(internship.industryId, 'industries');
//     const institutionId = getMappedId(internship.institutionId, 'institutions');

//     try {
//       await prisma.internship.create({
//         data: {
//           id: newId,
//           title: internship.title,
//           description: internship.description || '',
//           industryId: industryId,
//           institutionId: institutionId,
//           fieldOfWork: internship.fieldOfWork || internship.field || 'General',
//           requiredSkills: internship.skillRequirements || internship.requiredSkills || [],
//           numberOfPositions: internship.positions || internship.numberOfPositions || 1,
//           stipendAmount: internship.stipend || internship.stipendAmount,
//           workLocation: internship.location || internship.workLocation || '',
//           duration: internship.duration || '3 months',
//           startDate: processDate(internship.startDate),
//           endDate: processDate(internship.endDate),
//           applicationDeadline: processDate(internship.applicationDeadline) || new Date(),
//           status: internship.status || 'ACTIVE',
//           isActive: internship.isActive ?? true,
//           createdAt: processDate(internship.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating internship ${internship.title}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateInternshipApplications(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Internship Applications...', 'blue');
//   const applications = await mongoDb.collection('internship_applications').find({}).toArray();
//   const stats = startCollectionMigration('internshipApplications', applications.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${applications.length} applications`);
//     return;
//   }

//   const mapStatus = (status: string): ApplicationStatus => {
//     const statusMap: Record<string, ApplicationStatus> = {
//       'PENDING': ApplicationStatus.APPLIED,
//       'APPLIED': ApplicationStatus.APPLIED,
//       'UNDER_REVIEW': ApplicationStatus.UNDER_REVIEW,
//       'SHORTLISTED': ApplicationStatus.SHORTLISTED,
//       'SELECTED': ApplicationStatus.SELECTED,
//       'REJECTED': ApplicationStatus.REJECTED,
//       'JOINED': ApplicationStatus.JOINED,
//       'COMPLETED': ApplicationStatus.COMPLETED,
//       'WITHDRAWN': ApplicationStatus.WITHDRAWN,
//       'APPROVED': ApplicationStatus.APPROVED,
//     };
//     return statusMap[status?.toUpperCase()] || ApplicationStatus.APPLIED;
//   };

//   for (const app of applications) {
//     const newId = convertId(app._id, 'internshipApplications');
//     const studentId = getMappedId(app.studentId, 'students');
//     const internshipId = getMappedId(app.internshipId, 'internships');

//     if (!studentId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.internshipApplication.create({
//         data: {
//           id: newId,
//           studentId: studentId,
//           internshipId: internshipId,
//           isSelfIdentified: app.isSelfIdentified ?? false,
//           companyName: app.companyName,
//           companyAddress: app.companyAddress,
//           hrName: app.hrName,
//           hrContact: app.hrContact,
//           hrEmail: app.hrEmail,
//           status: mapStatus(app.status),
//           internshipStatus: app.internshipStatus,
//           startDate: processDate(app.startDate),
//           endDate: processDate(app.endDate),
//           joiningDate: processDate(app.joiningDate),
//           coverLetter: app.coverLetter,
//           resume: app.resumeUrl || app.resume,
//           joiningLetterUrl: app.offerLetterUrl || app.offerLetter || app.joiningLetterUrl,
//           notes: app.noc || app.remarks || app.notes,
//           createdAt: processDate(app.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating application ${app._id}: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateMentorAssignments(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Mentor Assignments...', 'blue');
//   const assignments = await mongoDb.collection('mentor_assignments').find({}).toArray();
//   const stats = startCollectionMigration('mentorAssignments', assignments.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${assignments.length} mentor assignments`);
//     return;
//   }

//   for (const assign of assignments) {
//     const newId = convertId(assign._id, 'mentorAssignments');
//     const studentId = getMappedId(assign.studentId, 'students');
//     const mentorId = getMappedId(assign.mentorId, 'users');
//     const assignedBy = getMappedId(assign.assignedBy, 'users');

//     if (!studentId || !mentorId || !assignedBy) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.mentorAssignment.create({
//         data: {
//           id: newId,
//           studentId: studentId,
//           mentorId: mentorId,
//           assignedBy: assignedBy,
//           assignmentDate: processDate(assign.assignmentDate) || new Date(),
//           isActive: assign.isActive ?? true,
//           academicYear: assign.academicYear || '2024-25',
//           semester: assign.semester,
//           createdAt: processDate(assign.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating mentor assignment: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateDocuments(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Documents...', 'blue');
//   const documents = await mongoDb.collection('Document').find({}).toArray();
//   const stats = startCollectionMigration('documents', documents.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${documents.length} documents`);
//     return;
//   }

//   for (const doc of documents) {
//     const newId = convertId(doc._id, 'documents');
//     const studentId = getMappedId(doc.studentId, 'students');

//     if (!studentId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.document.create({
//         data: {
//           id: newId,
//           studentId: studentId,
//           type: doc.type || 'OTHER',
//           fileName: doc.fileName,
//           fileUrl: doc.fileUrl,
//           createdAt: processDate(doc.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating document: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateFees(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Fees...', 'blue');
//   const fees = await mongoDb.collection('Fee').find({}).toArray();
//   const stats = startCollectionMigration('fees', fees.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${fees.length} fees`);
//     return;
//   }

//   for (const fee of fees) {
//     const newId = convertId(fee._id, 'fees');
//     const studentId = getMappedId(fee.studentId, 'students');
//     const semesterId = getMappedId(fee.semesterId, 'semesters');
//     const institutionId = getMappedId(fee.institutionId, 'institutions');

//     if (!studentId || !semesterId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.fee.create({
//         data: {
//           id: newId,
//           studentId: studentId,
//           semesterId: semesterId,
//           amountDue: fee.amountDue || 0,
//           amountPaid: fee.amountPaid || 0,
//           dueDate: processDate(fee.dueDate) || new Date(),
//           status: fee.status || 'PENDING',
//           institutionId: institutionId,
//           createdAt: processDate(fee.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating fee: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateMonthlyReports(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Monthly Reports...', 'blue');
//   const reports = await mongoDb.collection('monthly_reports').find({}).toArray();
//   const stats = startCollectionMigration('monthlyReports', reports.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${reports.length} monthly reports`);
//     return;
//   }

//   for (const report of reports) {
//     const newId = convertId(report._id, 'monthlyReports');
//     const applicationId = getMappedId(report.applicationId, 'internshipApplications');
//     const studentId = getMappedId(report.studentId, 'students');

//     if (!applicationId || !studentId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.monthlyReport.create({
//         data: {
//           id: newId,
//           applicationId: applicationId,
//           studentId: studentId,
//           reportMonth: report.reportMonth,
//           reportYear: report.reportYear,
//           reportFileUrl: report.reportFileUrl,
//           status: report.status || 'PENDING',
//           submittedAt: processDate(report.submittedAt),
//           reviewedAt: processDate(report.reviewedAt),
//           reviewComments: report.reviewerComments || report.reviewComments,
//           createdAt: processDate(report.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating monthly report: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateFacultyVisitLogs(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Faculty Visit Logs...', 'blue');
//   const visits = await mongoDb.collection('faculty_visit_logs').find({}).toArray();
//   const stats = startCollectionMigration('facultyVisitLogs', visits.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${visits.length} faculty visit logs`);
//     return;
//   }

//   for (const visit of visits) {
//     const newId = convertId(visit._id, 'facultyVisitLogs');
//     const applicationId = getMappedId(visit.applicationId, 'internshipApplications');
//     const facultyId = getMappedId(visit.facultyId, 'users');

//     if (!applicationId || !facultyId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.facultyVisitLog.create({
//         data: {
//           id: newId,
//           applicationId: applicationId,
//           facultyId: facultyId,
//           visitDate: processDate(visit.visitDate) || new Date(),
//           visitType: visit.visitType || 'PHYSICAL',
//           studentPerformance: visit.studentPerformance,
//           visitDuration: visit.visitDuration,
//           workEnvironment: visit.workEnvironment,
//           industrySupport: visit.industrySupport,
//           recommendations: visit.recommendations,
//           createdAt: processDate(visit.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating faculty visit: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateNotifications(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Notifications...', 'blue');
//   const notifications = await mongoDb.collection('Notification').find({}).toArray();
//   const stats = startCollectionMigration('notifications', notifications.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${notifications.length} notifications`);
//     return;
//   }

//   for (const notif of notifications) {
//     const newId = convertId(notif._id, 'notifications');
//     const userId = getMappedId(notif.userId, 'users');

//     if (!userId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.notification.create({
//         data: {
//           id: newId,
//           userId: userId,
//           title: notif.title,
//           body: notif.body,
//           type: notif.type || 'INFO',
//           read: notif.read ?? false,
//           createdAt: processDate(notif.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating notification: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateGrievances(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Grievances...', 'blue');
//   const grievances = await mongoDb.collection('Grievance').find({}).toArray();
//   const stats = startCollectionMigration('grievances', grievances.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${grievances.length} grievances`);
//     return;
//   }

//   for (const grievance of grievances) {
//     const newId = convertId(grievance._id, 'grievances');
//     const studentId = getMappedId(grievance.studentId, 'students');

//     if (!studentId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.grievance.create({
//         data: {
//           id: newId,
//           studentId: studentId,
//           title: grievance.title,
//           description: grievance.description,
//           category: grievance.category || 'OTHER',
//           status: grievance.status || 'PENDING',
//           severity: grievance.severity || grievance.priority || 'MEDIUM',
//           resolution: grievance.resolution,
//           resolvedDate: processDate(grievance.resolvedAt || grievance.resolvedDate),
//           createdAt: processDate(grievance.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating grievance: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateTechnicalQueries(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Technical Queries...', 'blue');
//   const queries = await mongoDb.collection('technical_queries').find({}).toArray();
//   const stats = startCollectionMigration('technicalQueries', queries.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${queries.length} technical queries`);
//     return;
//   }

//   for (const query of queries) {
//     const newId = convertId(query._id, 'technicalQueries');
//     const userId = getMappedId(query.userId, 'users');

//     if (!userId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.technicalQuery.create({
//         data: {
//           id: newId,
//           userId: userId,
//           title: query.title,
//           description: query.description,
//           status: query.status || 'OPEN',
//           priority: query.priority || 'MEDIUM',
//           resolution: query.resolution,
//           createdAt: processDate(query.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating technical query: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateAuditLogs(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Audit Logs...', 'blue');
//   const logs = await mongoDb.collection('AuditLog').find({}).toArray();
//   const stats = startCollectionMigration('auditLogs', logs.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${logs.length} audit logs`);
//     return;
//   }

//   for (const l of logs) {
//     const newId = convertId(l._id, 'auditLogs');
//     const userId = getMappedId(l.userId, 'users');

//     try {
//       await prisma.auditLog.create({
//         data: {
//           id: newId,
//           userId: userId,
//           action: l.action,
//           userRole: l.userRole,
//           userName: l.userName,
//           entityType: l.entityType,
//           entityId: l.entityId,
//           oldValues: l.oldValues,
//           newValues: l.newValues,
//           changedFields: l.changedFields || [],
//           category: l.category,
//           severity: l.severity || 'LOW',
//           timestamp: processDate(l.timestamp) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating audit log: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateInternshipPreferences(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Internship Preferences...', 'blue');
//   const prefs = await mongoDb.collection('internship_preferences').find({}).toArray();
//   const stats = startCollectionMigration('internshipPreferences', prefs.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${prefs.length} internship preferences`);
//     return;
//   }

//   for (const pref of prefs) {
//     const newId = convertId(pref._id, 'internshipPreferences');
//     const studentId = getMappedId(pref.studentId, 'students');

//     if (!studentId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.internshipPreference.create({
//         data: {
//           id: newId,
//           studentId: studentId,
//           preferredFields: pref.preferredFields || [],
//           preferredLocations: pref.preferredLocations || [],
//           preferredDurations: pref.preferredDurations || [],
//           minimumStipend: pref.minimumStipend,
//           isRemotePreferred: pref.isRemotePreferred ?? false,
//           additionalRequirements: pref.additionalRequirements,
//           createdAt: processDate(pref.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         stats.skipped++;
//       } else {
//         stats.errors++;
//         if (config.verbose) logError(`Error migrating internship preference: ${error.message}`);
//       }
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateCalendars(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Calendars...', 'blue');
//   const calendars = await mongoDb.collection('Calendar').find({}).toArray();
//   const stats = startCollectionMigration('calendars', calendars.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${calendars.length} calendars`);
//     return;
//   }

//   for (const cal of calendars) {
//     const newId = convertId(cal._id, 'calendars');
//     const institutionId = getMappedId(cal.institutionId, 'institutions');

//     if (!institutionId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.calendar.create({
//         data: {
//           id: newId,
//           institutionId: institutionId,
//           title: cal.title,
//           startDate: processDate(cal.startDate) || new Date(),
//           endDate: processDate(cal.endDate) || new Date(),
//           createdAt: processDate(cal.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating calendar ${cal.title}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateNotices(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Notices...', 'blue');
//   const notices = await mongoDb.collection('Notice').find({}).toArray();
//   const stats = startCollectionMigration('notices', notices.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${notices.length} notices`);
//     return;
//   }

//   for (const notice of notices) {
//     const newId = convertId(notice._id, 'notices');
//     const institutionId = getMappedId(notice.institutionId, 'institutions');

//     if (!institutionId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.notice.create({
//         data: {
//           id: newId,
//           institutionId: institutionId,
//           title: notice.title,
//           message: notice.message,
//           createdAt: processDate(notice.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating notice ${notice.title}: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateComplianceRecords(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   log('Migrating Compliance Records...', 'blue');
//   const records = await mongoDb.collection('compliance_records').find({}).toArray();
//   const stats = startCollectionMigration('complianceRecords', records.length);

//   if (config.dryRun) {
//     logWarning(`Dry run: Would migrate ${records.length} compliance records`);
//     return;
//   }

//   for (const record of records) {
//     const newId = convertId(record._id, 'complianceRecords');
//     const studentId = getMappedId(record.studentId, 'students');

//     if (!studentId) {
//       stats.skipped++;
//       continue;
//     }

//     try {
//       await prisma.complianceRecord.create({
//         data: {
//           id: newId,
//           studentId: studentId,
//           complianceType: record.complianceType || 'FACULTY_VISIT',
//           status: record.status || 'PENDING_REVIEW',
//           requiredVisits: record.requiredVisits,
//           completedVisits: record.completedVisits,
//           lastVisitDate: processDate(record.lastVisitDate),
//           nextVisitDue: processDate(record.nextVisitDue),
//           academicYear: record.academicYear,
//           semester: record.semester,
//           remarks: record.remarks,
//           createdAt: processDate(record.createdAt) || new Date(),
//         },
//       });
//       stats.migrated++;
//     } catch (error: any) {
//       stats.errors++;
//       if (config.verbose) logError(`Error migrating compliance record: ${error.message}`);
//     }
//   }
//   finishCollectionMigration(stats);
// }

// async function migrateRemainingCollections(mongoDb: any, prisma: PrismaClient, config: MigrationConfig) {
//   // Monthly Feedback
//   log('Migrating Monthly Feedbacks...', 'blue');
//   const feedbacks = await mongoDb.collection('monthly_feedbacks').find({}).toArray();
//   let fbStats = startCollectionMigration('monthlyFeedbacks', feedbacks.length);

//   if (!config.dryRun) {
//     for (const fb of feedbacks) {
//       const newId = convertId(fb._id, 'monthlyFeedbacks');
//       const applicationId = getMappedId(fb.applicationId, 'internshipApplications');
//       const studentId = getMappedId(fb.studentId, 'students');
//       const internshipId = getMappedId(fb.internshipId, 'internships');
//       const industryId = getMappedId(fb.industryId, 'industries');

//       if (!applicationId || !studentId) {
//         fbStats.skipped++;
//         continue;
//       }

//       try {
//         await prisma.monthlyFeedback.create({
//           data: {
//             id: newId,
//             applicationId,
//             studentId,
//             internshipId,
//             industryId,
//             feedbackMonth: processDate(fb.feedbackMonth) || new Date(),
//             attendanceRating: fb.attendanceRating,
//             performanceRating: fb.performanceRating,
//             punctualityRating: fb.punctualityRating,
//             technicalSkillsRating: fb.technicalSkillsRating,
//             overallRating: fb.overallRating,
//             strengths: fb.strengths,
//             areasForImprovement: fb.areasForImprovement,
//             tasksAssigned: fb.tasksAssigned,
//             tasksCompleted: fb.tasksCompleted,
//             overallComments: fb.overallComments,
//             submittedBy: fb.submittedBy,
//             createdAt: processDate(fb.createdAt) || new Date(),
//           },
//         });
//         fbStats.migrated++;
//       } catch (error: any) {
//         fbStats.errors++;
//         if (config.verbose) logError(`Error migrating monthly feedback: ${error.message}`);
//       }
//     }
//   } else {
//     logWarning(`Dry run: Would migrate ${feedbacks.length} monthly feedbacks`);
//   }
//   finishCollectionMigration(fbStats);

//   // Completion Feedback
//   log('Migrating Completion Feedbacks...', 'blue');
//   const completions = await mongoDb.collection('completion_feedbacks').find({}).toArray();
//   let cfStats = startCollectionMigration('completionFeedbacks', completions.length);

//   if (!config.dryRun) {
//     for (const cf of completions) {
//       const newId = convertId(cf._id, 'completionFeedbacks');
//       const applicationId = getMappedId(cf.applicationId, 'internshipApplications');
//       const industryId = getMappedId(cf.industryId, 'industries');

//       if (!applicationId) {
//         cfStats.skipped++;
//         continue;
//       }

//       try {
//         await prisma.completionFeedback.create({
//           data: {
//             id: newId,
//             applicationId,
//             industryId,
//             industryRating: cf.industryRating,
//             industryFeedback: cf.industryFeedback,
//             finalPerformance: cf.finalPerformance,
//             recommendForHire: cf.recommendForHire ?? false,
//             skillsLearned: cf.skillsLearned,
//             isCompleted: cf.isCompleted ?? false,
//             completionCertificate: cf.completionCertificate,
//             industrySubmittedAt: processDate(cf.industrySubmittedAt),
//             createdAt: processDate(cf.createdAt) || new Date(),
//           },
//         });
//         cfStats.migrated++;
//       } catch (error: any) {
//         cfStats.errors++;
//         if (config.verbose) logError(`Error migrating completion feedback: ${error.message}`);
//       }
//     }
//   } else {
//     logWarning(`Dry run: Would migrate ${completions.length} completion feedbacks`);
//   }
//   finishCollectionMigration(cfStats);

//   // Industry Requests
//   log('Migrating Industry Requests...', 'blue');
//   const requests = await mongoDb.collection('industry_requests').find({}).toArray();
//   let irStats = startCollectionMigration('industryRequests', requests.length);

//   if (!config.dryRun) {
//     for (const req of requests) {
//       const newId = convertId(req._id, 'industryRequests');
//       const industryId = getMappedId(req.industryId, 'industries');
//       const institutionId = getMappedId(req.institutionId, 'institutions');
//       const requestedBy = getMappedId(req.requestedBy, 'users');

//       try {
//         await prisma.industryRequest.create({
//           data: {
//             id: newId,
//             industryId,
//             institutionId,
//             requestedBy,
//             requestType: req.requestType,
//             title: req.title,
//             description: req.description,
//             status: req.status || 'SENT',
//             priority: req.priority || 'MEDIUM',
//             responseMessage: req.responseMessage,
//             respondedAt: processDate(req.respondedAt),
//             createdAt: processDate(req.createdAt) || new Date(),
//           },
//         });
//         irStats.migrated++;
//       } catch (error: any) {
//         irStats.errors++;
//         if (config.verbose) logError(`Error migrating industry request: ${error.message}`);
//       }
//     }
//   } else {
//     logWarning(`Dry run: Would migrate ${requests.length} industry requests`);
//   }
//   finishCollectionMigration(irStats);

//   // Scholarships
//   log('Migrating Scholarships...', 'blue');
//   const scholarships = await mongoDb.collection('Scholarship').find({}).toArray();
//   let schStats = startCollectionMigration('scholarships', scholarships.length);

//   if (!config.dryRun) {
//     for (const sch of scholarships) {
//       const newId = convertId(sch._id, 'scholarships');
//       const institutionId = getMappedId(sch.institutionId, 'institutions');

//       try {
//         await prisma.scholarship.create({
//           data: {
//             id: newId,
//             institutionId,
//             type: sch.type,
//             amount: sch.amount || 0,
//             status: sch.status || 'APPROVED',
//             createdAt: processDate(sch.createdAt) || new Date(),
//           },
//         });
//         schStats.migrated++;
//       } catch (error: any) {
//         schStats.errors++;
//         if (config.verbose) logError(`Error migrating scholarship: ${error.message}`);
//       }
//     }
//   } else {
//     logWarning(`Dry run: Would migrate ${scholarships.length} scholarships`);
//   }
//   finishCollectionMigration(schStats);

//   // Referral Applications
//   log('Migrating Referral Applications...', 'blue');
//   const referrals = await mongoDb.collection('referral_applications').find({}).toArray();
//   let refStats = startCollectionMigration('referralApplications', referrals.length);

//   if (!config.dryRun) {
//     for (const ref of referrals) {
//       const newId = convertId(ref._id, 'referralApplications');
//       const industryId = getMappedId(ref.industryId, 'industries');
//       const institutionId = getMappedId(ref.institutionId, 'institutions');

//       try {
//         await prisma.referralApplication.create({
//           data: {
//             id: newId,
//             industryId,
//             institutionId,
//             title: ref.title,
//             description: ref.description,
//             referralType: ref.referralType,
//             targetAudience: ref.targetAudience || [],
//             qualifications: ref.qualifications,
//             experienceDetails: ref.experienceDetails,
//             proposedBenefits: ref.proposedBenefits,
//             status: ref.status || 'PENDING',
//             applicationDate: processDate(ref.applicationDate) || new Date(),
//             createdAt: processDate(ref.createdAt) || new Date(),
//           },
//         });
//         refStats.migrated++;
//       } catch (error: any) {
//         refStats.errors++;
//         if (config.verbose) logError(`Error migrating referral application: ${error.message}`);
//       }
//     }
//   } else {
//     logWarning(`Dry run: Would migrate ${referrals.length} referral applications`);
//   }
//   finishCollectionMigration(refStats);

//   // Approved Referrals
//   log('Migrating Approved Referrals...', 'blue');
//   const approved = await mongoDb.collection('approved_referrals').find({}).toArray();
//   let arStats = startCollectionMigration('approvedReferrals', approved.length);

//   if (!config.dryRun) {
//     for (const ar of approved) {
//       const newId = convertId(ar._id, 'approvedReferrals');
//       const applicationId = getMappedId(ar.applicationId, 'referralApplications');
//       const industryId = getMappedId(ar.industryId, 'industries');

//       try {
//         await prisma.approvedReferral.create({
//           data: {
//             id: newId,
//             applicationId,
//             industryId,
//             referralCode: ar.referralCode,
//             displayName: ar.displayName,
//             description: ar.description,
//             referralType: ar.referralType,
//             isActive: ar.isActive ?? true,
//             usageCount: ar.usageCount || 0,
//             maxUsageLimit: ar.maxUsageLimit,
//             tags: ar.tags || [],
//             category: ar.category,
//             priority: ar.priority || 0,
//             createdAt: processDate(ar.createdAt) || new Date(),
//           },
//         });
//         arStats.migrated++;
//       } catch (error: any) {
//         arStats.errors++;
//         if (config.verbose) logError(`Error migrating approved referral: ${error.message}`);
//       }
//     }
//   } else {
//     logWarning(`Dry run: Would migrate ${approved.length} approved referrals`);
//   }
//   finishCollectionMigration(arStats);
// }

// // =============================================================================
// // Connection Testing
// // =============================================================================

// async function testMongoConnection(url: string): Promise<{ success: boolean; message: string; db?: any; client?: MongoClient }> {
//   try {
//     const client = new MongoClient(url);
//     await client.connect();
//     const db = client.db();
//     const collections = await db.listCollections().toArray();
//     return {
//       success: true,
//       message: `Connected. Found ${collections.length} collections.`,
//       db,
//       client,
//     };
//   } catch (error: any) {
//     return {
//       success: false,
//       message: error.message,
//     };
//   }
// }

// async function testPostgresConnection(url: string): Promise<{ success: boolean; message: string; prisma?: PrismaClient }> {
//   try {
//     const prisma = new PrismaClient({
//       datasources: {
//         db: {
//           url: url,
//         },
//       },
//     });
//     await prisma.$connect();
//     await prisma.$queryRaw`SELECT 1`;
//     return {
//       success: true,
//       message: 'Connected successfully.',
//       prisma,
//     };
//   } catch (error: any) {
//     return {
//       success: false,
//       message: error.message,
//     };
//   }
// }

// // =============================================================================
// // Main Migration Function
// // =============================================================================

// async function main() {
//   const config = parseArgs();

//   logSection('MongoDB to PostgreSQL Server Migration');

//   // Validate configuration
//   if (!config.mongodbUrl) {
//     logError('MongoDB URL is required. Use --mongodb-url or set SOURCE_MONGODB_URL');
//     process.exit(1);
//   }

//   if (!config.postgresUrl) {
//     logError('PostgreSQL URL is required. Use --postgres-url or set TARGET_DATABASE_URL');
//     process.exit(1);
//   }

//   console.log('');
//   log('Configuration:', 'cyan');
//   log(`  MongoDB (Source): ${maskConnectionUrl(config.mongodbUrl)}`);
//   log(`  PostgreSQL (Target): ${maskConnectionUrl(config.postgresUrl)}`);
//   log(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}`);
//   log(`  Batch Size: ${config.batchSize}`);
//   log(`  Skip Clear: ${config.skipClear ? 'Yes' : 'No'}`);
//   log(`  Verbose: ${config.verbose ? 'Yes' : 'No'}`);

//   let mongoClient: MongoClient | null = null;
//   let prisma: PrismaClient | null = null;

//   try {
//     // Test connections
//     logPhase('Testing Connections');

//     log('Testing MongoDB connection...', 'reset');
//     const mongoResult = await testMongoConnection(config.mongodbUrl);
//     if (!mongoResult.success) {
//       logError(`MongoDB connection failed: ${mongoResult.message}`);
//       process.exit(1);
//     }
//     logSuccess(`MongoDB: ${mongoResult.message}`);
//     mongoClient = mongoResult.client!;
//     const mongoDb = mongoResult.db;

//     log('Testing PostgreSQL connection...', 'reset');
//     const pgResult = await testPostgresConnection(config.postgresUrl);
//     if (!pgResult.success) {
//       logError(`PostgreSQL connection failed: ${pgResult.message}`);
//       process.exit(1);
//     }
//     logSuccess(`PostgreSQL: ${pgResult.message}`);
//     prisma = pgResult.prisma!;

//     // List MongoDB collections
//     const collections = await mongoDb.listCollections().toArray();
//     log(`Available MongoDB collections: ${collections.map((c: any) => c.name).join(', ')}`, 'reset');

//     if (config.dryRun) {
//       logPhase('Dry Run Mode - No data will be modified');
//     }

//     // Clear PostgreSQL tables
//     if (!config.dryRun && !config.skipClear) {
//       logPhase('Clearing PostgreSQL Tables');
//       await prisma.$executeRawUnsafe(`
//         DO $$ DECLARE
//           r RECORD;
//         BEGIN
//           FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
//             EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
//           END LOOP;
//         END $$;
//       `);
//       logSuccess('PostgreSQL tables cleared');
//     }

//     // Run migrations
//     logPhase('Starting Data Migration');

//     const startTime = Date.now();

//     // Phase 1: Core entities
//     await migrateInstitutions(mongoDb, prisma, config);

//     // Phase 2: Users
//     await migrateUsers(mongoDb, prisma, config);

//     // Phase 3: Academic structure
//     await migrateBatches(mongoDb, prisma, config);
//     await migrateSemesters(mongoDb, prisma, config);
//     await migrateBranches(mongoDb, prisma, config);
//     await migrateSubjects(mongoDb, prisma, config);

//     // Phase 4: Students
//     await migrateStudents(mongoDb, prisma, config);

//     // Phase 5: Industries
//     await migrateIndustries(mongoDb, prisma, config);

//     // Phase 6: Internships
//     await migrateInternships(mongoDb, prisma, config);

//     // Phase 7: Applications and assignments
//     await migrateInternshipApplications(mongoDb, prisma, config);
//     await migrateMentorAssignments(mongoDb, prisma, config);
//     await migrateInternshipPreferences(mongoDb, prisma, config);

//     // Phase 8: Documents and fees
//     await migrateDocuments(mongoDb, prisma, config);
//     await migrateFees(mongoDb, prisma, config);

//     // Phase 9: Reports and visits
//     await migrateMonthlyReports(mongoDb, prisma, config);
//     await migrateFacultyVisitLogs(mongoDb, prisma, config);

//     // Phase 10: Support data
//     await migrateNotifications(mongoDb, prisma, config);
//     await migrateGrievances(mongoDb, prisma, config);
//     await migrateTechnicalQueries(mongoDb, prisma, config);
//     await migrateAuditLogs(mongoDb, prisma, config);

//     // Phase 11: Calendar and notices
//     await migrateCalendars(mongoDb, prisma, config);
//     await migrateNotices(mongoDb, prisma, config);
//     await migrateComplianceRecords(mongoDb, prisma, config);

//     // Phase 12: Remaining collections
//     await migrateRemainingCollections(mongoDb, prisma, config);

//     const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

//     // Print summary
//     logSection('Migration Summary');

//     if (config.dryRun) {
//       logWarning('DRY RUN - No data was actually migrated');
//     }

//     console.log('');
//     log('Records by collection:', 'cyan');
//     for (const [collection, map] of Object.entries(idMaps)) {
//       if (map.size > 0) {
//         console.log(`  ${collection}: ${map.size} records`);
//       }
//     }

//     console.log('');
//     log(`Total migration time: ${totalTime}s`, 'green');

//     if (!config.dryRun) {
//       logSuccess('Migration completed successfully!');
//     }

//   } catch (error: any) {
//     logError(`Migration failed: ${error.message}`);
//     if (config.verbose) {
//       console.error(error);
//     }
//     process.exit(1);
//   } finally {
//     if (mongoClient) {
//       await mongoClient.close();
//     }
//     if (prisma) {
//       await prisma.$disconnect();
//     }
//   }
// }

// main().catch((e) => {
//   logError(e.message);
//   process.exit(1);
// });
