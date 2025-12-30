// /**
//  * MongoDB to PostgreSQL Migration Script
//  *
//  * This script migrates all data from MongoDB to PostgreSQL while:
//  * - Converting MongoDB ObjectIds to UUIDs
//  * - Maintaining referential integrity
//  * - Preserving all relationships
//  *
//  * Prerequisites:
//  * 1. PostgreSQL database created and Prisma migrations run
//  * 2. MongoDB connection available
//  * 3. Both databases accessible
//  *
//  * Usage:
//  *   npx ts-node prisma/migrate-mongo-to-postgres.ts
//  */

// import { PrismaClient, ApplicationStatus } from '@prisma/client';
// import { MongoClient, ObjectId } from 'mongodb';
// import { v4 as uuidv4 } from 'uuid';

// // Configuration
// const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://admin:Admin%401234@147.93.106.69:27017/cms_db?authSource=admin&directConnection=true';

// const prisma = new PrismaClient();

// // ID mapping: MongoDB ObjectId -> PostgreSQL UUID
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

// // Helper to convert ObjectId to UUID
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

// // Helper to safely get mapped ID
// function getMappedId(objectId: string | ObjectId | null | undefined, collection: string): string | null {
//   if (!objectId) return null;

//   const idStr = objectId.toString();
//   const map = idMaps[collection];

//   return map?.get(idStr) || null;
// }

// // Process date fields
// function processDate(value: any): Date | null {
//   if (!value) return null;
//   if (value instanceof Date) return value;
//   if (typeof value === 'string' || typeof value === 'number') {
//     const date = new Date(value);
//     return isNaN(date.getTime()) ? null : date;
//   }
//   return null;
// }

// // Migration functions for each collection
// async function migrateInstitutions(mongoDb: any) {
//   console.log('Migrating Institutions...');
//   const institutions = await mongoDb.collection('Institution').find({}).toArray();

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
//     } catch (error) {
//       console.error(`Error migrating institution ${inst.name}:`, error);
//     }
//   }

//   console.log(`Migrated ${institutions.length} institutions`);
// }

// async function migrateUsers(mongoDb: any) {
//   console.log('Migrating Users...');
//   const users = await mongoDb.collection('User').find({}).toArray();
//   const processedEmails = new Set<string>();
//   let migrated = 0;
//   let duplicates = 0;

//   for (const user of users) {
//     const newId = convertId(user._id, 'users');
//     const institutionId = getMappedId(user.institutionId, 'institutions');

//     // Check if email is duplicate
//     const email = user.email?.toLowerCase();
//     const isDuplicate = email && processedEmails.has(email);

//     if (email && !isDuplicate) {
//       processedEmails.add(email);
//     }

//     // For duplicates, use a placeholder email (cleared) with unique ObjectId suffix
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
//           active: isDuplicate ? false : (user.active ?? true), // Mark duplicates as inactive
//           institutionId: institutionId,
//           designation: user.designation,
//           phoneNo: user.phoneNo,
//           rollNumber: user.rollNumber,
//           branchName: user.branchName,
//           dob: user.dob,
//           createdAt: processDate(user.createdAt) || new Date(),
//         },
//       });
//       migrated++;
//       if (isDuplicate) duplicates++;
//     } catch (error: any) {
//       console.error(`Error migrating user ${user.email}:`, error.message || error);
//     }
//   }

//   console.log(`Migrated ${migrated} users (${duplicates} with emails cleared as duplicates)`);
// }

// async function migrateBatches(mongoDb: any) {
//   console.log('Migrating Batches...');
//   const batches = await mongoDb.collection('Batch').find({}).toArray();

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
//     } catch (error) {
//       console.error(`Error migrating batch ${batch.name}:`, error);
//     }
//   }

//   console.log(`Migrated ${batches.length} batches`);
// }

// async function migrateSemesters(mongoDb: any) {
//   console.log('Migrating Semesters...');
//   const semesters = await mongoDb.collection('Semester').find({}).toArray();

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
//     } catch (error) {
//       console.error(`Error migrating semester ${sem.number}:`, error);
//     }
//   }

//   console.log(`Migrated ${semesters.length} semesters`);
// }

// async function migrateBranches(mongoDb: any) {
//   console.log('Migrating Branches...');
//   const branches = await mongoDb.collection('branches').find({}).toArray();

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
//     } catch (error) {
//       console.error(`Error migrating branch ${branch.name}:`, error);
//     }
//   }

//   console.log(`Migrated ${branches.length} branches`);
// }

// async function migrateSubjects(mongoDb: any) {
//   console.log('Migrating Subjects...');
//   const subjects = await mongoDb.collection('Subject').find({}).toArray();

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
//     } catch (error) {
//       console.error(`Error migrating subject ${subject.subjectName}:`, error);
//     }
//   }

//   console.log(`Migrated ${subjects.length} subjects`);
// }

// async function migrateStudents(mongoDb: any) {
//   console.log('Migrating Students...');
//   const students = await mongoDb.collection('Student').find({}).toArray();
//   const processedUserIds = new Map<string, string>(); // mapped userId -> first student's UUID
//   let migrated = 0;
//   let duplicates = 0;

//   for (const student of students) {
//     const userId = getMappedId(student.userId, 'users');
//     const institutionId = getMappedId(student.institutionId, 'institutions');
//     const branchId = getMappedId(student.branchId, 'branches');
//     const batchId = getMappedId(student.batchId, 'batches');

//     if (!userId) continue;

//     // Check for duplicate userId (one user can only have one student)
//     const isDuplicate = processedUserIds.has(userId);

//     if (isDuplicate) {
//       // Map this student's _id to the first student's UUID with same userId
//       const existingUuid = processedUserIds.get(userId)!;
//       idMaps['students'].set(student._id.toString(), existingUuid);
//       duplicates++;
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
//       migrated++;
//     } catch (error: any) {
//       console.error(`Error migrating student ${student.rollNumber}:`, error.message || error);
//     }
//   }

//   console.log(`Migrated ${migrated} students (${duplicates} duplicates mapped to existing)`);
// }

// async function migrateIndustries(mongoDb: any) {
//   console.log('Migrating Industries...');
//   const industries = await mongoDb.collection('industries').find({}).toArray();

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
//     } catch (error) {
//       console.error(`Error migrating industry ${industry.companyName}:`, error);
//     }
//   }

//   console.log(`Migrated ${industries.length} industries`);
// }

// async function migrateInternships(mongoDb: any) {
//   console.log('Migrating Internships...');
//   const internships = await mongoDb.collection('internships').find({}).toArray();

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
//     } catch (error) {
//       console.error(`Error migrating internship ${internship.title}:`, error);
//     }
//   }

//   console.log(`Migrated ${internships.length} internships`);
// }

// async function migrateInternshipApplications(mongoDb: any) {
//   console.log('Migrating Internship Applications...');
//   const applications = await mongoDb.collection('internship_applications').find({}).toArray();
//   let migrated = 0;
//   let skipped = 0;

//   // Map PENDING to APPLIED (the valid enum value)
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
//       skipped++;
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
//       migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         skipped++; // Foreign key constraint - student doesn't exist
//       } else {
//         console.error(`Error migrating application ${app._id}:`, error.message || error);
//       }
//     }
//   }

//   console.log(`Migrated ${migrated} applications (${skipped} skipped due to missing references)`);
// }

// async function migrateMentorAssignments(mongoDb: any) {
//   console.log('Migrating Mentor Assignments...');
//   const assignments = await mongoDb.collection('mentor_assignments').find({}).toArray();
//   let migrated = 0;
//   let skipped = 0;

//   for (const assign of assignments) {
//     const newId = convertId(assign._id, 'mentorAssignments');
//     const studentId = getMappedId(assign.studentId, 'students');
//     const mentorId = getMappedId(assign.mentorId, 'users');
//     const assignedBy = getMappedId(assign.assignedBy, 'users');

//     if (!studentId || !mentorId || !assignedBy) {
//       skipped++;
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
//       migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         skipped++;
//       } else {
//         console.error(`Error migrating mentor assignment:`, error.message || error);
//       }
//     }
//   }

//   console.log(`Migrated ${migrated} mentor assignments (${skipped} skipped)`);
// }

// async function migrateDocuments(mongoDb: any) {
//   console.log('Migrating Documents...');
//   const documents = await mongoDb.collection('Document').find({}).toArray();
//   let migrated = 0;
//   let skipped = 0;

//   for (const doc of documents) {
//     const newId = convertId(doc._id, 'documents');
//     const studentId = getMappedId(doc.studentId, 'students');

//     if (!studentId) {
//       skipped++;
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
//       migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         skipped++;
//       } else {
//         console.error(`Error migrating document:`, error.message || error);
//       }
//     }
//   }

//   console.log(`Migrated ${migrated} documents (${skipped} skipped)`);
// }

// async function migrateFees(mongoDb: any) {
//   console.log('Migrating Fees...');
//   const fees = await mongoDb.collection('Fee').find({}).toArray();
//   let migrated = 0;
//   let skipped = 0;

//   for (const fee of fees) {
//     const newId = convertId(fee._id, 'fees');
//     const studentId = getMappedId(fee.studentId, 'students');
//     const semesterId = getMappedId(fee.semesterId, 'semesters');
//     const institutionId = getMappedId(fee.institutionId, 'institutions');

//     if (!studentId || !semesterId) {
//       skipped++;
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
//       migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         skipped++;
//       } else {
//         console.error(`Error migrating fee:`, error.message || error);
//       }
//     }
//   }

//   console.log(`Migrated ${migrated} fees (${skipped} skipped)`);
// }

// async function migrateMonthlyReports(mongoDb: any) {
//   console.log('Migrating Monthly Reports...');
//   const reports = await mongoDb.collection('monthly_reports').find({}).toArray();
//   let migrated = 0;
//   let skipped = 0;

//   for (const report of reports) {
//     const newId = convertId(report._id, 'monthlyReports');
//     const applicationId = getMappedId(report.applicationId, 'internshipApplications');
//     const studentId = getMappedId(report.studentId, 'students');

//     if (!applicationId || !studentId) {
//       skipped++;
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
//       migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         skipped++;
//       } else {
//         console.error(`Error migrating monthly report:`, error.message || error);
//       }
//     }
//   }

//   console.log(`Migrated ${migrated} monthly reports (${skipped} skipped)`);
// }

// async function migrateFacultyVisitLogs(mongoDb: any) {
//   console.log('Migrating Faculty Visit Logs...');
//   const visits = await mongoDb.collection('faculty_visit_logs').find({}).toArray();
//   let migrated = 0;
//   let skipped = 0;

//   for (const visit of visits) {
//     const newId = convertId(visit._id, 'facultyVisitLogs');
//     const applicationId = getMappedId(visit.applicationId, 'internshipApplications');
//     const facultyId = getMappedId(visit.facultyId, 'users');

//     if (!applicationId || !facultyId) {
//       skipped++;
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
//       migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         skipped++;
//       } else {
//         console.error(`Error migrating faculty visit:`, error.message || error);
//       }
//     }
//   }

//   console.log(`Migrated ${migrated} faculty visit logs (${skipped} skipped)`);
// }

// async function migrateNotifications(mongoDb: any) {
//   console.log('Migrating Notifications...');
//   const notifications = await mongoDb.collection('Notification').find({}).toArray();
//   let migrated = 0;
//   let skipped = 0;

//   for (const notif of notifications) {
//     const newId = convertId(notif._id, 'notifications');
//     const userId = getMappedId(notif.userId, 'users');

//     if (!userId) {
//       skipped++;
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
//       migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         skipped++;
//       } else {
//         console.error(`Error migrating notification:`, error.message || error);
//       }
//     }
//   }

//   console.log(`Migrated ${migrated} notifications (${skipped} skipped)`);
// }

// async function migrateGrievances(mongoDb: any) {
//   console.log('Migrating Grievances...');
//   const grievances = await mongoDb.collection('Grievance').find({}).toArray();
//   let migrated = 0;
//   let skipped = 0;

//   for (const grievance of grievances) {
//     const newId = convertId(grievance._id, 'grievances');
//     const studentId = getMappedId(grievance.studentId, 'students');

//     if (!studentId) {
//       skipped++;
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
//       migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         skipped++;
//       } else {
//         console.error(`Error migrating grievance:`, error.message || error);
//       }
//     }
//   }

//   console.log(`Migrated ${migrated} grievances (${skipped} skipped)`);
// }

// async function migrateTechnicalQueries(mongoDb: any) {
//   console.log('Migrating Technical Queries...');
//   const queries = await mongoDb.collection('technical_queries').find({}).toArray();
//   let migrated = 0;
//   let skipped = 0;

//   for (const query of queries) {
//     const newId = convertId(query._id, 'technicalQueries');
//     const userId = getMappedId(query.userId, 'users');

//     if (!userId) {
//       skipped++;
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
//       migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         skipped++;
//       } else {
//         console.error(`Error migrating technical query:`, error.message || error);
//       }
//     }
//   }

//   console.log(`Migrated ${migrated} technical queries (${skipped} skipped)`);
// }

// async function migrateAuditLogs(mongoDb: any) {
//   console.log('Migrating Audit Logs...');
//   const logs = await mongoDb.collection('AuditLog').find({}).toArray();
//   let migrated = 0;
//   let skipped = 0;

//   for (const log of logs) {
//     const newId = convertId(log._id, 'auditLogs');
//     const userId = getMappedId(log.userId, 'users');

//     try {
//       await prisma.auditLog.create({
//         data: {
//           id: newId,
//           userId: userId,
//           action: log.action,
//           userRole: log.userRole,
//           userName: log.userName,
//           entityType: log.entityType,
//           entityId: log.entityId,
//           oldValues: log.oldValues,
//           newValues: log.newValues,
//           changedFields: log.changedFields || [],
//           category: log.category,
//           severity: log.severity || 'LOW',
//           timestamp: processDate(log.timestamp) || new Date(),
//         },
//       });
//       migrated++;
//     } catch (error: any) {
//       if (error.code === 'P2003') {
//         skipped++;
//       } else {
//         console.error(`Error migrating audit log:`, error.message || error);
//       }
//     }
//   }

//   console.log(`Migrated ${migrated} audit logs (${skipped} skipped)`);
// }

// async function migrateInternshipPreferences(mongoDb: any) {
//   console.log('Migrating Internship Preferences...');
//   const prefs = await mongoDb.collection('internship_preferences').find({}).toArray();

//   for (const pref of prefs) {
//     const newId = convertId(pref._id, 'internshipPreferences');
//     const studentId = getMappedId(pref.studentId, 'students');

//     if (!studentId) continue;

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
//     } catch (error) {
//       console.error(`Error migrating internship preference ${pref._id}:`, error);
//     }
//   }

//   console.log(`Migrated ${prefs.length} internship preferences`);
// }

// async function migrateCalendars(mongoDb: any) {
//   console.log('Migrating Calendars...');
//   const calendars = await mongoDb.collection('Calendar').find({}).toArray();

//   for (const cal of calendars) {
//     const newId = convertId(cal._id, 'calendars');
//     const institutionId = getMappedId(cal.institutionId, 'institutions');

//     if (!institutionId) continue;

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
//     } catch (error) {
//       console.error(`Error migrating calendar ${cal.title}:`, error);
//     }
//   }

//   console.log(`Migrated ${calendars.length} calendars`);
// }

// async function migrateNotices(mongoDb: any) {
//   console.log('Migrating Notices...');
//   const notices = await mongoDb.collection('Notice').find({}).toArray();

//   for (const notice of notices) {
//     const newId = convertId(notice._id, 'notices');
//     const institutionId = getMappedId(notice.institutionId, 'institutions');

//     if (!institutionId) continue;

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
//     } catch (error) {
//       console.error(`Error migrating notice ${notice.title}:`, error);
//     }
//   }

//   console.log(`Migrated ${notices.length} notices`);
// }

// async function migrateComplianceRecords(mongoDb: any) {
//   console.log('Migrating Compliance Records...');
//   const records = await mongoDb.collection('compliance_records').find({}).toArray();

//   for (const record of records) {
//     const newId = convertId(record._id, 'complianceRecords');
//     const studentId = getMappedId(record.studentId, 'students');

//     if (!studentId) continue;

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
//     } catch (error) {
//       console.error(`Error migrating compliance record ${record._id}:`, error);
//     }
//   }

//   console.log(`Migrated ${records.length} compliance records`);
// }

// // Additional collections migration functions...
// async function migrateRemainingCollections(mongoDb: any) {
//   // Monthly Feedback
//   console.log('Migrating Monthly Feedbacks...');
//   const feedbacks = await mongoDb.collection('monthly_feedbacks').find({}).toArray();
//   for (const fb of feedbacks) {
//     const newId = convertId(fb._id, 'monthlyFeedbacks');
//     const applicationId = getMappedId(fb.applicationId, 'internshipApplications');
//     const studentId = getMappedId(fb.studentId, 'students');
//     const internshipId = getMappedId(fb.internshipId, 'internships');
//     const industryId = getMappedId(fb.industryId, 'industries');

//     if (!applicationId || !studentId) continue;

//     try {
//       await prisma.monthlyFeedback.create({
//         data: {
//           id: newId,
//           applicationId,
//           studentId,
//           internshipId,
//           industryId,
//           feedbackMonth: processDate(fb.feedbackMonth) || new Date(),
//           attendanceRating: fb.attendanceRating,
//           performanceRating: fb.performanceRating,
//           punctualityRating: fb.punctualityRating,
//           technicalSkillsRating: fb.technicalSkillsRating,
//           overallRating: fb.overallRating,
//           strengths: fb.strengths,
//           areasForImprovement: fb.areasForImprovement,
//           tasksAssigned: fb.tasksAssigned,
//           tasksCompleted: fb.tasksCompleted,
//           overallComments: fb.overallComments,
//           submittedBy: fb.submittedBy,
//           createdAt: processDate(fb.createdAt) || new Date(),
//         },
//       });
//     } catch (error) {
//       console.error(`Error migrating monthly feedback:`, error);
//     }
//   }
//   console.log(`Migrated ${feedbacks.length} monthly feedbacks`);

//   // Completion Feedback
//   console.log('Migrating Completion Feedbacks...');
//   const completions = await mongoDb.collection('completion_feedbacks').find({}).toArray();
//   for (const cf of completions) {
//     const newId = convertId(cf._id, 'completionFeedbacks');
//     const applicationId = getMappedId(cf.applicationId, 'internshipApplications');
//     const industryId = getMappedId(cf.industryId, 'industries');

//     if (!applicationId) continue;

//     try {
//       await prisma.completionFeedback.create({
//         data: {
//           id: newId,
//           applicationId,
//           industryId,
//           industryRating: cf.industryRating,
//           industryFeedback: cf.industryFeedback,
//           finalPerformance: cf.finalPerformance,
//           recommendForHire: cf.recommendForHire ?? false,
//           skillsLearned: cf.skillsLearned,
//           isCompleted: cf.isCompleted ?? false,
//           completionCertificate: cf.completionCertificate,
//           industrySubmittedAt: processDate(cf.industrySubmittedAt),
//           createdAt: processDate(cf.createdAt) || new Date(),
//         },
//       });
//     } catch (error) {
//       console.error(`Error migrating completion feedback:`, error);
//     }
//   }
//   console.log(`Migrated ${completions.length} completion feedbacks`);

//   // Industry Requests
//   console.log('Migrating Industry Requests...');
//   const requests = await mongoDb.collection('industry_requests').find({}).toArray();
//   for (const req of requests) {
//     const newId = convertId(req._id, 'industryRequests');
//     const industryId = getMappedId(req.industryId, 'industries');
//     const institutionId = getMappedId(req.institutionId, 'institutions');
//     const requestedBy = getMappedId(req.requestedBy, 'users');

//     try {
//       await prisma.industryRequest.create({
//         data: {
//           id: newId,
//           industryId,
//           institutionId,
//           requestedBy,
//           requestType: req.requestType,
//           title: req.title,
//           description: req.description,
//           status: req.status || 'SENT',
//           priority: req.priority || 'MEDIUM',
//           responseMessage: req.responseMessage,
//           respondedAt: processDate(req.respondedAt),
//           createdAt: processDate(req.createdAt) || new Date(),
//         },
//       });
//     } catch (error) {
//       console.error(`Error migrating industry request:`, error);
//     }
//   }
//   console.log(`Migrated ${requests.length} industry requests`);

//   // Scholarships
//   console.log('Migrating Scholarships...');
//   const scholarships = await mongoDb.collection('Scholarship').find({}).toArray();
//   for (const sch of scholarships) {
//     const newId = convertId(sch._id, 'scholarships');
//     const institutionId = getMappedId(sch.institutionId, 'institutions');

//     try {
//       await prisma.scholarship.create({
//         data: {
//           id: newId,
//           institutionId,
//           type: sch.type,
//           amount: sch.amount || 0,
//           status: sch.status || 'APPROVED',
//           createdAt: processDate(sch.createdAt) || new Date(),
//         },
//       });
//     } catch (error) {
//       console.error(`Error migrating scholarship:`, error);
//     }
//   }
//   console.log(`Migrated ${scholarships.length} scholarships`);

//   // Referral Applications
//   console.log('Migrating Referral Applications...');
//   const referrals = await mongoDb.collection('referral_applications').find({}).toArray();
//   for (const ref of referrals) {
//     const newId = convertId(ref._id, 'referralApplications');
//     const industryId = getMappedId(ref.industryId, 'industries');
//     const institutionId = getMappedId(ref.institutionId, 'institutions');

//     try {
//       await prisma.referralApplication.create({
//         data: {
//           id: newId,
//           industryId,
//           institutionId,
//           title: ref.title,
//           description: ref.description,
//           referralType: ref.referralType,
//           targetAudience: ref.targetAudience || [],
//           qualifications: ref.qualifications,
//           experienceDetails: ref.experienceDetails,
//           proposedBenefits: ref.proposedBenefits,
//           status: ref.status || 'PENDING',
//           applicationDate: processDate(ref.applicationDate) || new Date(),
//           createdAt: processDate(ref.createdAt) || new Date(),
//         },
//       });
//     } catch (error) {
//       console.error(`Error migrating referral application:`, error);
//     }
//   }
//   console.log(`Migrated ${referrals.length} referral applications`);

//   // Approved Referrals
//   console.log('Migrating Approved Referrals...');
//   const approved = await mongoDb.collection('approved_referrals').find({}).toArray();
//   for (const ar of approved) {
//     const newId = convertId(ar._id, 'approvedReferrals');
//     const applicationId = getMappedId(ar.applicationId, 'referralApplications');
//     const industryId = getMappedId(ar.industryId, 'industries');

//     try {
//       await prisma.approvedReferral.create({
//         data: {
//           id: newId,
//           applicationId,
//           industryId,
//           referralCode: ar.referralCode,
//           displayName: ar.displayName,
//           description: ar.description,
//           referralType: ar.referralType,
//           isActive: ar.isActive ?? true,
//           usageCount: ar.usageCount || 0,
//           maxUsageLimit: ar.maxUsageLimit,
//           tags: ar.tags || [],
//           category: ar.category,
//           priority: ar.priority || 0,
//           createdAt: processDate(ar.createdAt) || new Date(),
//         },
//       });
//     } catch (error) {
//       console.error(`Error migrating approved referral:`, error);
//     }
//   }
//   console.log(`Migrated ${approved.length} approved referrals`);
// }

// // Main migration function
// async function main() {
//   console.log('='.repeat(60));
//   console.log('MongoDB to PostgreSQL Migration Script');
//   console.log('='.repeat(60));
//   console.log('');

//   let mongoClient: MongoClient | null = null;

//   try {
//     // Connect to MongoDB
//     console.log('Connecting to MongoDB...');
//     console.log('MongoDB URL:', MONGODB_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
//     mongoClient = new MongoClient(MONGODB_URL);
//     await mongoClient.connect();
//     const mongoDb = mongoClient.db();
//     console.log('Connected to MongoDB');

//     // List all collections to debug
//     const collections = await mongoDb.listCollections().toArray();
//     console.log('Available MongoDB collections:', collections.map(c => c.name).join(', '));
//     console.log('');

//     // Clear PostgreSQL tables (optional - comment out if you want incremental migration)
//     console.log('Clearing PostgreSQL tables...');
//     await prisma.$executeRawUnsafe(`
//       DO $$ DECLARE
//         r RECORD;
//       BEGIN
//         FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
//           EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
//         END LOOP;
//       END $$;
//     `);
//     console.log('PostgreSQL tables cleared');
//     console.log('');

//     // Run migrations in order (respecting foreign key relationships)
//     console.log('Starting data migration...');
//     console.log('-'.repeat(60));

//     // Phase 1: Core entities (no dependencies)
//     await migrateInstitutions(mongoDb);

//     // Phase 2: Users (depends on institutions)
//     await migrateUsers(mongoDb);

//     // Phase 3: Academic structure (depends on institutions)
//     await migrateBatches(mongoDb);
//     await migrateSemesters(mongoDb);
//     await migrateBranches(mongoDb);
//     await migrateSubjects(mongoDb);

//     // Phase 4: Students (depends on users, institutions, branches, batches)
//     await migrateStudents(mongoDb);

//     // Phase 5: Industries (depends on users)
//     await migrateIndustries(mongoDb);

//     // Phase 6: Internships (depends on industries, institutions)
//     await migrateInternships(mongoDb);

//     // Phase 7: Applications and assignments (depends on students, internships)
//     await migrateInternshipApplications(mongoDb);
//     await migrateMentorAssignments(mongoDb);
//     await migrateInternshipPreferences(mongoDb);

//     // Phase 8: Documents and fees (depends on students)
//     await migrateDocuments(mongoDb);
//     await migrateFees(mongoDb);

//     // Phase 9: Reports and visits (depends on applications)
//     await migrateMonthlyReports(mongoDb);
//     await migrateFacultyVisitLogs(mongoDb);

//     // Phase 10: Support data
//     await migrateNotifications(mongoDb);
//     await migrateGrievances(mongoDb);
//     await migrateTechnicalQueries(mongoDb);
//     await migrateAuditLogs(mongoDb);

//     // Phase 11: Calendar and notices
//     await migrateCalendars(mongoDb);
//     await migrateNotices(mongoDb);
//     await migrateComplianceRecords(mongoDb);

//     // Phase 12: Remaining collections
//     await migrateRemainingCollections(mongoDb);

//     console.log('');
//     console.log('-'.repeat(60));
//     console.log('Migration completed successfully!');
//     console.log('='.repeat(60));

//     // Print summary
//     console.log('');
//     console.log('Migration Summary:');
//     for (const [collection, map] of Object.entries(idMaps)) {
//       if (map.size > 0) {
//         console.log(`  ${collection}: ${map.size} records`);
//       }
//     }

//   } catch (error) {
//     console.error('Migration failed:', error);
//     throw error;
//   } finally {
//     if (mongoClient) {
//       await mongoClient.close();
//     }
//     await prisma.$disconnect();
//   }
// }

// main().catch((e) => {
//   console.error(e);
//   process.exit(1);
// });
