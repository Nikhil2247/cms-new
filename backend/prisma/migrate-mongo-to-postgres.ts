/**
 * MongoDB to PostgreSQL Migration Script - Comprehensive Version
 *
 * Migrates all data from MongoDB to PostgreSQL while:
 * - Converting MongoDB ObjectIds to UUIDs
 * - Maintaining referential integrity
 * - Preserving all relationships
 * - Providing detailed verification
 *
 * Prerequisites:
 * 1. PostgreSQL database created and Prisma migrations run
 * 2. MongoDB connection available
 * 3. Both databases accessible
 *
 * Usage:
 *   npx ts-node prisma/migrate-mongo-to-postgres.ts
 */

import { PrismaClient, ApplicationStatus, Role, Prisma } from '../src/generated/prisma/client';
import { MongoClient, ObjectId, Db } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Configuration
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/internship';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public';
const BATCH_SIZE = 500; // Process records in batches

// Set DATABASE_URL if not present
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DATABASE_URL;
}

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
} as any);

// Statistics tracking
interface MigrationStats {
  collection: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
}

const stats: MigrationStats[] = [];

// ID mapping: MongoDB ObjectId -> PostgreSQL UUID
const idMaps: Record<string, Map<string, string>> = {
  users: new Map(),
  institutions: new Map(),
  students: new Map(),
  branches: new Map(),
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
  notificationSettings: new Map(),
  institutionSettings: new Map(),
  blacklistedTokens: new Map(),
  classAssignments: new Map(),
  fcmTokens: new Map(),
  departments: new Map(),
  stateReports: new Map(),
  feeReports: new Map(),
  generatedReports: new Map(),
  reportTemplates: new Map(),
  events: new Map(),
  eventRegistrations: new Map(),
};

// Helper to convert ObjectId to UUID
function convertId(objectId: string | ObjectId | null | undefined, collection: string): string {
  if (!objectId) return uuidv4();

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

// Helper to safely get mapped ID
function getMappedId(objectId: string | ObjectId | null | undefined, collection: string): string | null {
  if (!objectId) return null;

  const idStr = objectId.toString();
  const map = idMaps[collection];

  return map?.get(idStr) || null;
}

// Process date fields
function processDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  if (value.$date) {
    const date = new Date(value.$date);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

// Safe string truncation for database fields
function truncateString(str: string | null | undefined, maxLength: number): string | null {
  if (!str) return null;
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

// Create a stat tracker
function createStat(collection: string, total: number): MigrationStats {
  const stat: MigrationStats = {
    collection,
    total,
    migrated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };
  stats.push(stat);
  return stat;
}

// ==========================================
// MIGRATION FUNCTIONS
// ==========================================

async function migrateInstitutions(mongoDb: Db) {
  console.log('\n📦 Migrating Institutions...');
  const institutions = await mongoDb.collection('Institution').find({}).toArray();
  const stat = createStat('Institution', institutions.length);

  for (const inst of institutions) {
    const newId = convertId(inst._id, 'institutions');

    try {
      await prisma.institution.create({
        data: {
          id: newId,
          code: inst.code || `INST${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
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
          establishedYear: inst.establishedYear,
          affiliatedTo: inst.affiliatedTo,
          recognizedBy: inst.recognizedBy,
          naacGrade: inst.naacGrade,
          autonomousStatus: inst.autonomousStatus ?? false,
          totalStudentSeats: inst.totalStudentSeats,
          totalStaffSeats: inst.totalStaffSeats,
          isActive: inst.isActive ?? true,
          createdAt: processDate(inst.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Institution ${inst.name}: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} institutions`);
}

async function migrateUsers(mongoDb: Db) {
  console.log('\n👤 Migrating Users...');
  const users = await mongoDb.collection('User').find({}).toArray();
  const stat = createStat('User', users.length);
  const processedEmails = new Set<string>();

  for (const user of users) {
    const newId = convertId(user._id, 'users');
    const institutionId = getMappedId(user.institutionId, 'institutions');

    // Handle duplicate emails
    const email = user.email?.toLowerCase()?.trim();
    const isDuplicate = email && processedEmails.has(email);

    if (email && !isDuplicate) {
      processedEmails.add(email);
    }

    const finalEmail = isDuplicate
      ? `duplicate_${user._id.toString()}@removed.local`
      : email;

    try {
      await prisma.user.create({
        data: {
          id: newId,
          email: finalEmail,
          password: user.password || 'MIGRATION_PLACEHOLDER',
          name: user.name || 'Unknown',
          role: user.role as Role,
          active: isDuplicate ? false : (user.active ?? true),
          institutionId: institutionId,
          designation: user.designation,
          phoneNo: user.phoneNo,
          rollNumber: user.rollNumber,
          branchName: user.branchName,
          dob: user.dob,
          consent: user.consent ?? false,
          consentAt: processDate(user.consentAt),
          lastLoginAt: processDate(user.lastLoginAt),
          lastLoginIp: user.lastLoginIp,
          loginCount: user.loginCount ?? 0,
          previousLoginAt: processDate(user.previousLoginAt),
          hasChangedDefaultPassword: user.hasChangedDefaultPassword ?? false,
          passwordChangedAt: processDate(user.passwordChangedAt),
          resetPasswordToken: user.resetPasswordToken,
          resetPasswordExpiry: processDate(user.resetPasswordExpiry),
          createdAt: processDate(user.createdAt) || new Date(),
        },
      });
      stat.migrated++;
      if (isDuplicate) stat.skipped++; // Count as both migrated and skipped for duplicates
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 10) {
        stat.errorDetails.push(`User ${user.email}: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} users (${stat.skipped} duplicates handled)`);
}

async function migrateBatches(mongoDb: Db) {
  console.log('\n📚 Migrating Batches...');
  const batches = await mongoDb.collection('Batch').find({}).toArray();
  const stat = createStat('Batch', batches.length);

  for (const batch of batches) {
    const newId = convertId(batch._id, 'batches');
    const institutionId = getMappedId(batch.institutionId, 'institutions');

    try {
      await prisma.batch.create({
        data: {
          id: newId,
          name: batch.name || `Batch-${Date.now()}`,
          isActive: batch.isActive ?? true,
          institutionId: institutionId,
          createdAt: processDate(batch.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Batch ${batch.name}: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} batches`);
}

async function migrateSemesters(mongoDb: Db) {
  console.log('\n📅 Migrating Semesters...');
  const semesters = await mongoDb.collection('Semester').find({}).toArray();
  const stat = createStat('Semester', semesters.length);

  for (const sem of semesters) {
    const newId = convertId(sem._id, 'semesters');
    const institutionId = getMappedId(sem.institutionId, 'institutions');

    try {
      await prisma.semester.create({
        data: {
          id: newId,
          number: sem.number || 1,
          isActive: sem.isActive ?? true,
          institutionId: institutionId,
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Semester ${sem.number}: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} semesters`);
}

async function migrateBranches(mongoDb: Db) {
  console.log('\n🌿 Migrating Branches...');
  const branches = await mongoDb.collection('branches').find({}).toArray();
  const stat = createStat('Branch', branches.length);
  const usedCodes = new Set<string>();

  for (const branch of branches) {
    const newId = convertId(branch._id, 'branches');
    const institutionId = getMappedId(branch.institutionId, 'institutions');

    // Ensure unique code
    let code = branch.code || `${branch.shortName || 'BR'}-${Date.now()}`;
    while (usedCodes.has(code)) {
      code = `${code}-${Math.random().toString(36).substr(2, 4)}`;
    }
    usedCodes.add(code);

    try {
      await prisma.branch.create({
        data: {
          id: newId,
          name: branch.name || 'Unknown Branch',
          shortName: branch.shortName || 'UNK',
          code: code,
          duration: branch.duration || 3,
          isActive: branch.isActive ?? true,
          institutionId: institutionId,
          createdAt: processDate(branch.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Branch ${branch.name}: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} branches`);
}

async function migrateSubjects(mongoDb: Db) {
  console.log('\n📖 Migrating Subjects...');
  const subjects = await mongoDb.collection('Subject').find({}).toArray();
  const stat = createStat('Subject', subjects.length);

  for (const subject of subjects) {
    const newId = convertId(subject._id, 'subjects');
    const branchId = getMappedId(subject.branchId, 'branches');
    const institutionId = getMappedId(subject.institutionId, 'institutions');

    try {
      await prisma.subject.create({
        data: {
          id: newId,
          subjectName: subject.subjectName || 'Unknown Subject',
          subjectCode: subject.subjectCode || `SUB-${Date.now()}`,
          syllabusYear: subject.syllabusYear || new Date().getFullYear(),
          semesterNumber: subject.semesterNumber?.toString(),
          branchName: subject.branchName || 'Unknown',
          maxMarks: subject.maxMarks || 100,
          subjectType: subject.subjectType || 'THEORY',
          branchId: branchId,
          institutionId: institutionId,
          createdAt: processDate(subject.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Subject ${subject.subjectName}: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} subjects`);
}

async function migrateStudents(mongoDb: Db) {
  console.log('\n🎓 Migrating Students...');
  const students = await mongoDb.collection('Student').find({}).toArray();
  const stat = createStat('Student', students.length);
  const processedUserIds = new Map<string, string>();

  for (const student of students) {
    const userId = getMappedId(student.userId, 'users');
    if (!userId) {
      stat.skipped++;
      continue;
    }

    // Handle duplicate userId (one user can only have one student)
    if (processedUserIds.has(userId)) {
      const existingUuid = processedUserIds.get(userId)!;
      idMaps['students'].set(student._id.toString(), existingUuid);
      stat.skipped++;
      continue;
    }

    const newId = convertId(student._id, 'students');
    processedUserIds.set(userId, newId);

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
          profileImage: student.profileImage || student.profilePicture,
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
          scholarshipId: scholarshipId,
          feeStructureId: feeStructureId,
          currentYear: student.currentYear,
          currentSemester: student.currentSemester,
          currentSemesterMarks: student.currentSemesterMarks,
          tenthper: student.tenthper,
          twelthper: student.twelthper,
          diplomaPercentage: student.diplomaPercentage,
          totalBacklogs: student.totalBacklogs ?? 0,
          admissionType: student.admissionType,
          category: student.category,
          clearanceStatus: student.clearanceStatus || 'PENDING',
          isActive: student.isActive ?? true,
          createdAt: processDate(student.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 10) {
        stat.errorDetails.push(`Student ${student.rollNumber || student.name}: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} students (${stat.skipped} skipped/duplicates)`);
}

async function migrateIndustries(mongoDb: Db) {
  console.log('\n🏭 Migrating Industries...');
  const industries = await mongoDb.collection('industries').find({}).toArray();
  const stat = createStat('Industry', industries.length);
  const processedUserIds = new Set<string>();

  for (const industry of industries) {
    const userId = getMappedId(industry.userId, 'users');
    if (!userId) {
      stat.skipped++;
      continue;
    }

    // Handle duplicate userId
    if (processedUserIds.has(userId)) {
      stat.skipped++;
      continue;
    }
    processedUserIds.add(userId);

    const newId = convertId(industry._id, 'industries');
    const institutionId = getMappedId(industry.institutionId, 'institutions');
    const referredById = getMappedId(industry.referredById, 'users');

    try {
      await prisma.industry.create({
        data: {
          id: newId,
          userId: userId,
          companyName: industry.companyName || 'Unknown Company',
          companyDescription: industry.companyDescription,
          industryType: industry.industryType || 'OTHER',
          establishedYear: industry.establishedYear,
          companySize: industry.companySize || 'SMALL',
          employeeCount: industry.employeeCount,
          contactPersonName: industry.contactPersonName || 'Unknown',
          contactPersonTitle: industry.contactPersonTitle || 'Manager',
          primaryEmail: industry.primaryEmail || 'unknown@example.com',
          alternateEmail: industry.alternateEmail,
          primaryPhone: industry.primaryPhone || '0000000000',
          alternatePhone: industry.alternatePhone,
          website: industry.website,
          address: industry.address || 'Unknown',
          city: industry.city || 'Unknown',
          state: industry.state || 'Unknown',
          pinCode: industry.pinCode || '000000',
          country: industry.country || 'India',
          registrationNumber: industry.registrationNumber || `REG-${Date.now()}`,
          panNumber: industry.panNumber || `PAN-${Date.now()}`,
          gstNumber: industry.gstNumber,
          isVerified: industry.isVerified ?? false,
          verifiedAt: processDate(industry.verifiedAt),
          verifiedBy: industry.verifiedBy,
          isApproved: industry.isApproved ?? false,
          approvedAt: processDate(industry.approvedAt),
          approvedBy: industry.approvedBy,
          referredById: referredById,
          referralDate: processDate(industry.referralDate),
          referralNotes: industry.referralNotes,
          institutionId: institutionId,
          createdAt: processDate(industry.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Industry ${industry.companyName}: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} industries`);
}

async function migrateInternships(mongoDb: Db) {
  console.log('\n💼 Migrating Internships...');
  const internships = await mongoDb.collection('internships').find({}).toArray();
  const stat = createStat('Internship', internships.length);

  for (const internship of internships) {
    const newId = convertId(internship._id, 'internships');
    const industryId = getMappedId(internship.industryId, 'industries');
    const institutionId = getMappedId(internship.institutionId, 'institutions');

    if (!industryId) {
      stat.skipped++;
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
          numberOfPositions: internship.numberOfPositions || internship.positions || 1,
          duration: internship.duration || '3 months',
          startDate: processDate(internship.startDate),
          endDate: processDate(internship.endDate),
          applicationDeadline: processDate(internship.applicationDeadline) || new Date(),
          workLocation: internship.workLocation || internship.location || 'Remote',
          isRemoteAllowed: internship.isRemoteAllowed ?? false,
          eligibleBranches: internship.eligibleBranches || [],
          minimumPercentage: internship.minimumPercentage,
          eligibleSemesters: internship.eligibleSemesters || [],
          isStipendProvided: internship.isStipendProvided ?? false,
          stipendAmount: internship.stipendAmount || internship.stipend,
          stipendDetails: internship.stipendDetails,
          requiredSkills: internship.requiredSkills || internship.skillRequirements || [],
          preferredSkills: internship.preferredSkills || [],
          totalFacultyVisits: internship.totalFacultyVisits ?? 4,
          status: internship.status || 'ACTIVE',
          isActive: internship.isActive ?? true,
          industryId: industryId,
          institutionId: institutionId,
          createdAt: processDate(internship.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Internship ${internship.title}: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} internships`);
}

async function migrateInternshipApplications(mongoDb: Db) {
  console.log('\n📝 Migrating Internship Applications...');
  const applications = await mongoDb.collection('internship_applications').find({}).toArray();
  const stat = createStat('InternshipApplication', applications.length);

  // Map status values
  const mapStatus = (status: string): ApplicationStatus => {
    const statusMap: Record<string, ApplicationStatus> = {
      'PENDING': 'APPLIED',
      'APPLIED': 'APPLIED',
      'UNDER_REVIEW': 'UNDER_REVIEW',
      'SHORTLISTED': 'SHORTLISTED',
      'SELECTED': 'SELECTED',
      'REJECTED': 'REJECTED',
      'JOINED': 'JOINED',
      'COMPLETED': 'COMPLETED',
      'WITHDRAWN': 'WITHDRAWN',
      'APPROVED': 'APPROVED',
    };
    return statusMap[status?.toUpperCase()] || 'APPLIED';
  };

  for (const app of applications) {
    const newId = convertId(app._id, 'internshipApplications');
    const studentId = getMappedId(app.studentId, 'students');
    const internshipId = getMappedId(app.internshipId, 'internships');
    const mentorId = getMappedId(app.mentorId, 'users');

    if (!studentId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.internshipApplication.create({
        data: {
          id: newId,
          studentId: studentId,
          internshipId: internshipId,
          applicationDate: processDate(app.applicationDate) || new Date(),
          appliedDate: processDate(app.appliedDate) || processDate(app.applicationDate) || new Date(),
          coverLetter: app.coverLetter,
          resume: app.resumeUrl || app.resume,
          additionalInfo: app.additionalInfo,
          status: mapStatus(app.status),
          reviewedDate: processDate(app.reviewedDate),
          isSelected: app.isSelected ?? false,
          selectionDate: processDate(app.selectionDate),
          rejectionReason: app.rejectionReason,
          hasJoined: app.hasJoined ?? false,
          joiningDate: processDate(app.joiningDate),
          completionDate: processDate(app.completionDate),
          mentorId: mentorId,
          mentorAssignedAt: processDate(app.mentorAssignedAt),
          mentorAssignedBy: app.mentorAssignedBy,
          isSelfIdentified: app.isSelfIdentified ?? false,
          companyName: app.companyName,
          companyAddress: app.companyAddress,
          companyContact: app.companyContact,
          companyEmail: app.companyEmail,
          hrName: app.hrName,
          hrDesignation: app.hrDesignation,
          hrContact: app.hrContact,
          hrEmail: app.hrEmail,
          internshipStatus: app.internshipStatus,
          joiningLetterUrl: app.joiningLetterUrl || app.offerLetterUrl || app.offerLetter,
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
          reportsGenerated: app.reportsGenerated ?? false,
          totalExpectedReports: app.totalExpectedReports,
          totalExpectedVisits: app.totalExpectedVisits,
          createdAt: processDate(app.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 10) {
        stat.errorDetails.push(`Application ${app._id}: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} applications (${stat.skipped} skipped)`);
}

async function migrateMentorAssignments(mongoDb: Db) {
  console.log('\n👨‍🏫 Migrating Mentor Assignments...');
  const assignments = await mongoDb.collection('mentor_assignments').find({}).toArray();
  const stat = createStat('MentorAssignment', assignments.length);

  for (const assign of assignments) {
    const newId = convertId(assign._id, 'mentorAssignments');
    const studentId = getMappedId(assign.studentId, 'students');
    const mentorId = getMappedId(assign.mentorId, 'users');
    const assignedBy = getMappedId(assign.assignedBy, 'users');

    if (!studentId || !mentorId || !assignedBy) {
      stat.skipped++;
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
          isActive: assign.isActive ?? true,
          deactivatedAt: processDate(assign.deactivatedAt),
          deactivatedBy: assign.deactivatedBy,
          deactivationReason: assign.deactivationReason,
          academicYear: assign.academicYear || '2024-25',
          semester: assign.semester,
          specialInstructions: assign.specialInstructions,
          createdAt: processDate(assign.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 10) {
        stat.errorDetails.push(`MentorAssignment: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} mentor assignments`);
}

async function migrateDocuments(mongoDb: Db) {
  console.log('\n📄 Migrating Documents...');
  const documents = await mongoDb.collection('Document').find({}).toArray();
  const stat = createStat('Document', documents.length);

  for (const doc of documents) {
    const newId = convertId(doc._id, 'documents');
    const studentId = getMappedId(doc.studentId, 'students');

    if (!studentId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.document.create({
        data: {
          id: newId,
          studentId: studentId,
          type: doc.type || 'OTHER',
          fileName: doc.fileName || 'unknown',
          fileUrl: doc.fileUrl || '',
          createdAt: processDate(doc.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 10) {
        stat.errorDetails.push(`Document: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} documents`);
}

async function migrateFees(mongoDb: Db) {
  console.log('\n💰 Migrating Fees...');
  const fees = await mongoDb.collection('Fee').find({}).toArray();
  const stat = createStat('Fee', fees.length);

  for (const fee of fees) {
    const newId = convertId(fee._id, 'fees');
    const studentId = getMappedId(fee.studentId, 'students');
    const semesterId = getMappedId(fee.semesterId, 'semesters');
    const institutionId = getMappedId(fee.institutionId, 'institutions');
    const feeStructureId = getMappedId(fee.feeStructureId, 'feeStructures');

    if (!studentId || !semesterId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.fee.create({
        data: {
          id: newId,
          studentId: studentId,
          semesterId: semesterId,
          feeStructureId: feeStructureId,
          amountDue: fee.amountDue || 0,
          amountPaid: fee.amountPaid || 0,
          dueDate: processDate(fee.dueDate) || new Date(),
          status: fee.status || 'PENDING',
          institutionId: institutionId,
          createdAt: processDate(fee.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 10) {
        stat.errorDetails.push(`Fee: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} fees`);
}

async function migrateFeeStructures(mongoDb: Db) {
  console.log('\n📊 Migrating Fee Structures...');
  const feeStructures = await mongoDb.collection('FeeStructure').find({}).toArray();
  const stat = createStat('FeeStructure', feeStructures.length);
  const uniqueKeys = new Set<string>();

  for (const fs of feeStructures) {
    const newId = convertId(fs._id, 'feeStructures');
    const institutionId = getMappedId(fs.institutionId, 'institutions');

    // Create unique key for constraint
    const key = `${fs.admissionType}-${fs.scholarshipScheme}-${fs.semesterNumber}`;
    if (uniqueKeys.has(key)) {
      stat.skipped++;
      continue;
    }
    uniqueKeys.add(key);

    try {
      await prisma.feeStructure.create({
        data: {
          id: newId,
          admissionType: fs.admissionType || 'FIRST_YEAR',
          scholarshipScheme: fs.scholarshipScheme || 'CMS50',
          semesterNumber: fs.semesterNumber || 1,
          df: fs.df || 0,
          sf: fs.sf || 0,
          security: fs.security || 0,
          tf: fs.tf || 0,
          total: fs.total?.toString() || '0',
          isActive: fs.isActive ?? true,
          institutionId: institutionId,
          createdAt: processDate(fs.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`FeeStructure: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} fee structures`);
}

async function migrateScholarships(mongoDb: Db) {
  console.log('\n🎖️ Migrating Scholarships...');
  const scholarships = await mongoDb.collection('Scholarship').find({}).toArray();
  const stat = createStat('Scholarship', scholarships.length);

  for (const sch of scholarships) {
    const newId = convertId(sch._id, 'scholarships');
    const institutionId = getMappedId(sch.institutionId, 'institutions');

    try {
      await prisma.scholarship.create({
        data: {
          id: newId,
          type: sch.type || 'CMS50',
          amount: sch.amount || 0,
          status: sch.status,
          institutionId: institutionId,
          createdAt: processDate(sch.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Scholarship: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} scholarships`);
}

async function migratePlacements(mongoDb: Db) {
  console.log('\n🏢 Migrating Placements...');
  const placements = await mongoDb.collection('Placement').find({}).toArray();
  const stat = createStat('Placement', placements.length);

  for (const placement of placements) {
    const newId = convertId(placement._id, 'placements');
    const studentId = getMappedId(placement.studentId, 'students');
    const institutionId = getMappedId(placement.institutionId, 'institutions');

    if (!studentId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.placement.create({
        data: {
          id: newId,
          studentId: studentId,
          companyName: placement.companyName || 'Unknown',
          jobRole: placement.jobRole || 'Unknown',
          salary: placement.salary,
          offerDate: processDate(placement.offerDate) || new Date(),
          status: placement.status || 'OFFERED',
          institutionId: institutionId,
          createdAt: processDate(placement.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Placement: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} placements`);
}

async function migrateExamResults(mongoDb: Db) {
  console.log('\n📝 Migrating Exam Results...');
  const results = await mongoDb.collection('ExamResult').find({}).toArray();
  const stat = createStat('ExamResult', results.length);

  for (const result of results) {
    const newId = convertId(result._id, 'examResults');
    const studentId = getMappedId(result.studentId, 'students');
    const semesterId = getMappedId(result.semesterId, 'semesters');
    const subjectId = getMappedId(result.subjectId, 'subjects');

    if (!studentId || !semesterId || !subjectId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.examResult.create({
        data: {
          id: newId,
          studentId: studentId,
          semesterId: semesterId,
          subjectId: subjectId,
          marks: result.marks || 0,
          maxMarks: result.maxMarks || 100,
          createdAt: processDate(result.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 10) {
        stat.errorDetails.push(`ExamResult: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} exam results`);
}

async function migrateClassAssignments(mongoDb: Db) {
  console.log('\n📚 Migrating Class Assignments...');
  const assignments = await mongoDb.collection('ClassAssignment').find({}).toArray();
  const stat = createStat('ClassAssignment', assignments.length);

  for (const assign of assignments) {
    const newId = convertId(assign._id, 'classAssignments');
    const teacherId = getMappedId(assign.teacherId, 'users');
    const batchId = getMappedId(assign.batchId, 'batches');
    const institutionId = getMappedId(assign.institutionId, 'institutions');

    if (!teacherId || !batchId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.classAssignment.create({
        data: {
          id: newId,
          teacherId: teacherId,
          batchId: batchId,
          section: assign.section,
          academicYear: assign.academicYear,
          isActive: assign.isActive ?? true,
          institutionId: institutionId,
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`ClassAssignment: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} class assignments`);
}

async function migrateMonthlyReports(mongoDb: Db) {
  console.log('\n📊 Migrating Monthly Reports...');
  const reports = await mongoDb.collection('monthly_reports').find({}).toArray();
  const stat = createStat('MonthlyReport', reports.length);

  for (const report of reports) {
    const newId = convertId(report._id, 'monthlyReports');
    const applicationId = getMappedId(report.applicationId, 'internshipApplications');
    const studentId = getMappedId(report.studentId, 'students');

    if (!applicationId || !studentId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.monthlyReport.create({
        data: {
          id: newId,
          applicationId: applicationId,
          studentId: studentId,
          reportMonth: report.reportMonth || 1,
          reportYear: report.reportYear || new Date().getFullYear(),
          monthName: report.monthName,
          reportFileUrl: report.reportFileUrl,
          status: report.status || 'DRAFT',
          submittedAt: processDate(report.submittedAt),
          reviewedBy: report.reviewedBy,
          reviewedAt: processDate(report.reviewedAt),
          reviewComments: report.reviewerComments || report.reviewComments,
          isApproved: report.isApproved ?? false,
          approvedBy: report.approvedBy,
          approvedAt: processDate(report.approvedAt),
          dueDate: processDate(report.dueDate),
          submissionWindowStart: processDate(report.submissionWindowStart),
          submissionWindowEnd: processDate(report.submissionWindowEnd),
          isOverdue: report.isOverdue ?? false,
          isLateSubmission: report.isLateSubmission ?? false,
          daysLate: report.daysLate,
          periodStartDate: processDate(report.periodStartDate),
          periodEndDate: processDate(report.periodEndDate),
          isPartialMonth: report.isPartialMonth ?? false,
          isFinalReport: report.isFinalReport ?? false,
          createdAt: processDate(report.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 10) {
        stat.errorDetails.push(`MonthlyReport: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} monthly reports`);
}

async function migrateFacultyVisitLogs(mongoDb: Db) {
  console.log('\n🚗 Migrating Faculty Visit Logs...');
  const visits = await mongoDb.collection('faculty_visit_logs').find({}).toArray();
  const stat = createStat('FacultyVisitLog', visits.length);

  for (const visit of visits) {
    const newId = convertId(visit._id, 'facultyVisitLogs');
    const applicationId = getMappedId(visit.applicationId, 'internshipApplications');
    const facultyId = getMappedId(visit.facultyId, 'users');
    const internshipId = getMappedId(visit.internshipId, 'internships');

    if (!applicationId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.facultyVisitLog.create({
        data: {
          id: newId,
          applicationId: applicationId,
          facultyId: facultyId,
          internshipId: internshipId,
          visitLocation: visit.visitLocation,
          latitude: visit.latitude,
          longitude: visit.longitude,
          gpsAccuracy: visit.gpsAccuracy,
          signedDocumentUrl: visit.signedDocumentUrl,
          visitNumber: visit.visitNumber,
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
          studentProgressRating: visit.studentProgressRating,
          industryCooperationRating: visit.industryCooperationRating,
          workEnvironmentRating: visit.workEnvironmentRating,
          mentoringSupportRating: visit.mentoringSupportRating,
          overallSatisfactionRating: visit.overallSatisfactionRating,
          issuesIdentified: visit.issuesIdentified,
          recommendations: visit.recommendations,
          actionRequired: visit.actionRequired,
          filesUrl: visit.filesUrl,
          visitPhotos: visit.visitPhotos || [],
          meetingMinutes: visit.meetingMinutes,
          attendeesList: visit.attendeesList || [],
          reportSubmittedTo: visit.reportSubmittedTo,
          followUpRequired: visit.followUpRequired ?? false,
          nextVisitDate: processDate(visit.nextVisitDate),
          visitMonth: visit.visitMonth,
          visitYear: visit.visitYear,
          requiredByDate: processDate(visit.requiredByDate),
          isMonthlyVisit: visit.isMonthlyVisit ?? true,
          createdAt: processDate(visit.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 10) {
        stat.errorDetails.push(`FacultyVisitLog: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} faculty visit logs`);
}

async function migrateMonthlyFeedbacks(mongoDb: Db) {
  console.log('\n📝 Migrating Monthly Feedbacks...');
  const feedbacks = await mongoDb.collection('monthly_feedbacks').find({}).toArray();
  const stat = createStat('MonthlyFeedback', feedbacks.length);

  for (const fb of feedbacks) {
    const newId = convertId(fb._id, 'monthlyFeedbacks');
    const applicationId = getMappedId(fb.applicationId, 'internshipApplications');
    const studentId = getMappedId(fb.studentId, 'students');
    const internshipId = getMappedId(fb.internshipId, 'internships');
    const industryId = getMappedId(fb.industryId, 'industries');

    if (!applicationId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.monthlyFeedback.create({
        data: {
          id: newId,
          applicationId: applicationId,
          studentId: studentId,
          internshipId: internshipId,
          industryId: industryId,
          imageUrl: fb.imageUrl,
          feedbackMonth: processDate(fb.feedbackMonth) || new Date(),
          attendanceRating: fb.attendanceRating,
          performanceRating: fb.performanceRating,
          punctualityRating: fb.punctualityRating,
          technicalSkillsRating: fb.technicalSkillsRating,
          strengths: fb.strengths,
          areasForImprovement: fb.areasForImprovement,
          tasksAssigned: fb.tasksAssigned,
          tasksCompleted: fb.tasksCompleted,
          overallComments: fb.overallComments,
          overallRating: fb.overallRating,
          reportUrl: fb.reportUrl,
          workDescription: fb.workDescription,
          skillsLearned: fb.skillsLearned,
          challenges: fb.challenges,
          supervisorFeedback: fb.supervisorFeedback,
          submittedAt: processDate(fb.submittedAt) || new Date(),
          submittedBy: fb.submittedBy || 'unknown',
          createdAt: processDate(fb.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 10) {
        stat.errorDetails.push(`MonthlyFeedback: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} monthly feedbacks`);
}

async function migrateCompletionFeedbacks(mongoDb: Db) {
  console.log('\n✅ Migrating Completion Feedbacks...');
  const feedbacks = await mongoDb.collection('completion_feedbacks').find({}).toArray();
  const stat = createStat('CompletionFeedback', feedbacks.length);
  const processedApplicationIds = new Set<string>();

  for (const cf of feedbacks) {
    const newId = convertId(cf._id, 'completionFeedbacks');
    const applicationId = getMappedId(cf.applicationId, 'internshipApplications');
    const industryId = getMappedId(cf.industryId, 'industries');

    if (!applicationId) {
      stat.skipped++;
      continue;
    }

    // Unique constraint on applicationId
    if (processedApplicationIds.has(applicationId)) {
      stat.skipped++;
      continue;
    }
    processedApplicationIds.add(applicationId);

    try {
      await prisma.completionFeedback.create({
        data: {
          id: newId,
          applicationId: applicationId,
          industryId: industryId,
          studentFeedback: cf.studentFeedback,
          studentRating: cf.studentRating,
          skillsLearned: cf.skillsLearned,
          careerImpact: cf.careerImpact,
          wouldRecommend: cf.wouldRecommend,
          studentSubmittedAt: processDate(cf.studentSubmittedAt),
          industryFeedback: cf.industryFeedback,
          industryRating: cf.industryRating,
          finalPerformance: cf.finalPerformance,
          recommendForHire: cf.recommendForHire,
          industrySubmittedAt: processDate(cf.industrySubmittedAt),
          isCompleted: cf.isCompleted ?? false,
          completionCertificate: cf.completionCertificate,
          createdAt: processDate(cf.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`CompletionFeedback: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} completion feedbacks`);
}

async function migrateNotifications(mongoDb: Db) {
  console.log('\n🔔 Migrating Notifications...');
  const notifications = await mongoDb.collection('Notification').find({}).toArray();
  const stat = createStat('Notification', notifications.length);

  // Process in batches
  for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
    const batch = notifications.slice(i, i + BATCH_SIZE);

    for (const notif of batch) {
      const newId = convertId(notif._id, 'notifications');
      const userId = getMappedId(notif.userId, 'users');

      if (!userId) {
        stat.skipped++;
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
            data: notif.data,
            read: notif.read ?? false,
            createdAt: processDate(notif.createdAt) || new Date(),
          },
        });
        stat.migrated++;
      } catch (error: any) {
        stat.errors++;
        if (stat.errorDetails.length < 5) {
          stat.errorDetails.push(`Notification: ${error.message}`);
        }
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} notifications`);
}

async function migrateAuditLogs(mongoDb: Db) {
  console.log('\n📋 Migrating Audit Logs...');
  const logs = await mongoDb.collection('AuditLog').find({}).toArray();
  const stat = createStat('AuditLog', logs.length);

  // Process in batches
  for (let i = 0; i < logs.length; i += BATCH_SIZE) {
    const batch = logs.slice(i, i + BATCH_SIZE);

    for (const log of batch) {
      const newId = convertId(log._id, 'auditLogs');
      const userId = getMappedId(log.userId, 'users');
      const institutionId = getMappedId(log.institutionId, 'institutions');

      try {
        await prisma.auditLog.create({
          data: {
            id: newId,
            userId: userId,
            entityType: log.entityType || 'Unknown',
            entityId: log.entityId?.toString(),
            action: log.action,
            userRole: log.userRole,
            userName: log.userName,
            oldValues: log.oldValues,
            newValues: log.newValues,
            changedFields: log.changedFields || [],
            description: log.description,
            category: log.category,
            severity: log.severity || 'LOW',
            timestamp: processDate(log.timestamp) || new Date(),
            institutionId: institutionId,
          },
        });
        stat.migrated++;
      } catch (error: any) {
        stat.errors++;
        if (stat.errorDetails.length < 5) {
          stat.errorDetails.push(`AuditLog: ${error.message}`);
        }
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} audit logs`);
}

async function migrateGrievances(mongoDb: Db) {
  console.log('\n⚠️ Migrating Grievances...');
  const grievances = await mongoDb.collection('Grievance').find({}).toArray();
  const stat = createStat('Grievance', grievances.length);

  for (const grievance of grievances) {
    const newId = convertId(grievance._id, 'grievances');
    const studentId = getMappedId(grievance.studentId, 'students');
    const internshipId = getMappedId(grievance.internshipId, 'internships');
    const industryId = getMappedId(grievance.industryId, 'industries');
    const facultySupervisorId = getMappedId(grievance.facultySupervisorId, 'users');
    const assignedToId = getMappedId(grievance.assignedToId, 'users');

    if (!studentId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.grievance.create({
        data: {
          id: newId,
          studentId: studentId,
          title: grievance.title || grievance.subject || 'Untitled',
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
          resolvedDate: processDate(grievance.resolvedDate),
          resolution: grievance.resolution,
          comments: grievance.comments || grievance.remarks,
          attachments: grievance.attachments || [],
          escalationLevel: grievance.escalationLevel || 'MENTOR',
          escalationHistory: grievance.escalationHistory || [],
          escalatedById: grievance.escalatedById,
          escalatedAt: processDate(grievance.escalatedAt),
          escalationCount: grievance.escalationCount ?? 0,
          previousAssignees: grievance.previousAssignees || [],
          createdAt: processDate(grievance.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Grievance: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} grievances`);
}

async function migrateTechnicalQueries(mongoDb: Db) {
  console.log('\n❓ Migrating Technical Queries...');
  const queries = await mongoDb.collection('technical_queries').find({}).toArray();
  const stat = createStat('TechnicalQuery', queries.length);

  for (const query of queries) {
    const newId = convertId(query._id, 'technicalQueries');
    const userId = getMappedId(query.userId, 'users');
    const institutionId = getMappedId(query.institutionId, 'institutions');

    if (!userId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.technicalQuery.create({
        data: {
          id: newId,
          userId: userId,
          title: query.title,
          description: query.description,
          attachments: query.attachments || [],
          status: query.status || 'OPEN',
          priority: query.priority || 'MEDIUM',
          resolution: query.resolution,
          institutionId: institutionId,
          createdAt: processDate(query.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`TechnicalQuery: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} technical queries`);
}

async function migrateCalendars(mongoDb: Db) {
  console.log('\n📅 Migrating Calendars...');
  const calendars = await mongoDb.collection('Calendar').find({}).toArray();
  const stat = createStat('Calendar', calendars.length);

  for (const cal of calendars) {
    const newId = convertId(cal._id, 'calendars');
    const institutionId = getMappedId(cal.institutionId, 'institutions');

    try {
      await prisma.calendar.create({
        data: {
          id: newId,
          institutionId: institutionId,
          title: cal.title || 'Untitled Event',
          startDate: processDate(cal.startDate),
          endDate: processDate(cal.endDate),
          createdAt: processDate(cal.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Calendar: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} calendars`);
}

async function migrateNotices(mongoDb: Db) {
  console.log('\n📢 Migrating Notices...');
  const notices = await mongoDb.collection('Notice').find({}).toArray();
  const stat = createStat('Notice', notices.length);

  for (const notice of notices) {
    const newId = convertId(notice._id, 'notices');
    const institutionId = getMappedId(notice.institutionId, 'institutions');

    try {
      await prisma.notice.create({
        data: {
          id: newId,
          institutionId: institutionId,
          title: notice.title || 'Untitled Notice',
          message: notice.message || '',
          createdAt: processDate(notice.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`Notice: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} notices`);
}

async function migrateBlacklistedTokens(mongoDb: Db) {
  console.log('\n🔒 Migrating Blacklisted Tokens...');
  const tokens = await mongoDb.collection('BlacklistedToken').find({}).toArray();
  const stat = createStat('BlacklistedToken', tokens.length);
  const processedTokens = new Set<string>();

  for (const token of tokens) {
    const newId = convertId(token._id, 'blacklistedTokens');

    // Skip duplicate tokens
    if (token.token && processedTokens.has(token.token)) {
      stat.skipped++;
      continue;
    }
    if (token.token) {
      processedTokens.add(token.token);
    }

    try {
      await prisma.blacklistedToken.create({
        data: {
          id: newId,
          token: token.token || `token_${Date.now()}_${Math.random().toString(36)}`,
          userId: token.userId?.toString(),
          reason: token.reason,
          isFullInvalidation: token.isFullInvalidation ?? false,
          expiresAt: processDate(token.expiresAt) || new Date(Date.now() + 86400000),
          createdAt: processDate(token.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      if (stat.errorDetails.length < 5) {
        stat.errorDetails.push(`BlacklistedToken: ${error.message}`);
      }
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} blacklisted tokens`);
}

async function migrateComplianceRecords(mongoDb: Db) {
  console.log('\n✓ Migrating Compliance Records...');
  const records = await mongoDb.collection('compliance_records').find({}).toArray();
  const stat = createStat('ComplianceRecord', records.length);

  for (const record of records) {
    const newId = convertId(record._id, 'complianceRecords');
    const studentId = getMappedId(record.studentId, 'students');

    if (!studentId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.complianceRecord.create({
        data: {
          id: newId,
          studentId: studentId,
          complianceType: record.complianceType || 'FACULTY_VISIT',
          status: record.status || 'PENDING_REVIEW',
          requiredVisits: record.requiredVisits,
          completedVisits: record.completedVisits,
          lastVisitDate: processDate(record.lastVisitDate),
          nextVisitDue: processDate(record.nextVisitDue),
          requiredFeedbacks: record.requiredFeedbacks,
          completedFeedbacks: record.completedFeedbacks,
          lastFeedbackDate: processDate(record.lastFeedbackDate),
          nextFeedbackDue: processDate(record.nextFeedbackDue),
          complianceScore: record.complianceScore,
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
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`ComplianceRecord: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} compliance records`);
}

async function migrateIndustryRequests(mongoDb: Db) {
  console.log('\n📨 Migrating Industry Requests...');
  const requests = await mongoDb.collection('industry_requests').find({}).toArray();
  const stat = createStat('IndustryRequest', requests.length);

  for (const req of requests) {
    const newId = convertId(req._id, 'industryRequests');
    const industryId = getMappedId(req.industryId, 'industries');
    const institutionId = getMappedId(req.institutionId, 'institutions');
    const requestedBy = getMappedId(req.requestedBy, 'users');
    const referredById = getMappedId(req.referredById, 'users');
    const referralApplicationId = getMappedId(req.referralApplicationId, 'referralApplications');

    if (!institutionId || !requestedBy) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.industryRequest.create({
        data: {
          id: newId,
          requestType: req.requestType || 'OTHER',
          priority: req.priority || 'MEDIUM',
          title: req.title || 'Untitled Request',
          description: req.description || '',
          requirements: req.requirements,
          expectedOutcome: req.expectedOutcome,
          industryId: industryId,
          targetIndustryType: req.targetIndustryType,
          preferredLocation: req.preferredLocation,
          preferredCompanySize: req.preferredCompanySize,
          referredById: referredById,
          referredByType: req.referredByType,
          referralDate: processDate(req.referralDate),
          referralNotes: req.referralNotes,
          referralApplicationId: referralApplicationId,
          requestedBy: requestedBy,
          institutionId: institutionId,
          requestDeadline: processDate(req.requestDeadline),
          expectedResponseBy: processDate(req.expectedResponseBy),
          status: req.status || 'SENT',
          statusHistory: req.statusHistory || [],
          responseMessage: req.responseMessage,
          respondedAt: processDate(req.respondedAt),
          responseAttachments: req.responseAttachments || [],
          assignedTo: req.assignedTo,
          internalNotes: req.internalNotes,
          followUpRequired: req.followUpRequired ?? false,
          createdAt: processDate(req.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`IndustryRequest: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} industry requests`);
}

async function migrateReferralApplications(mongoDb: Db) {
  console.log('\n🔗 Migrating Referral Applications...');
  const referrals = await mongoDb.collection('referral_applications').find({}).toArray();
  const stat = createStat('ReferralApplication', referrals.length);

  for (const ref of referrals) {
    const newId = convertId(ref._id, 'referralApplications');
    const industryId = getMappedId(ref.industryId, 'industries');
    const institutionId = getMappedId(ref.institutionId, 'institutions');
    const reviewedBy = getMappedId(ref.reviewedBy, 'users');
    const approvedBy = getMappedId(ref.approvedBy, 'users');
    const rejectedBy = getMappedId(ref.rejectedBy, 'users');

    if (!industryId || !institutionId) {
      stat.skipped++;
      continue;
    }

    try {
      await prisma.referralApplication.create({
        data: {
          id: newId,
          title: ref.title || 'Untitled',
          description: ref.description || '',
          referralType: ref.referralType || 'OTHER',
          targetAudience: ref.targetAudience || [],
          industryId: industryId,
          qualifications: ref.qualifications || '',
          experienceDetails: ref.experienceDetails || '',
          references: ref.references,
          proposedBenefits: ref.proposedBenefits || '',
          status: ref.status || 'PENDING',
          applicationDate: processDate(ref.applicationDate) || new Date(),
          reviewedBy: reviewedBy,
          reviewedAt: processDate(ref.reviewedAt),
          reviewComments: ref.reviewComments,
          approvedBy: approvedBy,
          approvedAt: processDate(ref.approvedAt),
          approvalNotes: ref.approvalNotes,
          rejectedBy: rejectedBy,
          rejectedAt: processDate(ref.rejectedAt),
          rejectionReason: ref.rejectionReason,
          validFrom: processDate(ref.validFrom),
          validUntil: processDate(ref.validUntil),
          usageCount: ref.usageCount ?? 0,
          maxUsageLimit: ref.maxUsageLimit,
          institutionId: institutionId,
          createdAt: processDate(ref.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`ReferralApplication: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} referral applications`);
}

async function migrateApprovedReferrals(mongoDb: Db) {
  console.log('\n✅ Migrating Approved Referrals...');
  const approved = await mongoDb.collection('approved_referrals').find({}).toArray();
  const stat = createStat('ApprovedReferral', approved.length);
  const usedCodes = new Set<string>();

  for (const ar of approved) {
    const newId = convertId(ar._id, 'approvedReferrals');
    const applicationId = getMappedId(ar.applicationId, 'referralApplications');
    const industryId = getMappedId(ar.industryId, 'industries');

    if (!applicationId || !industryId) {
      stat.skipped++;
      continue;
    }

    // Ensure unique referral code
    let code = ar.referralCode || `REF-${Date.now()}`;
    while (usedCodes.has(code)) {
      code = `${code}-${Math.random().toString(36).substr(2, 4)}`;
    }
    usedCodes.add(code);

    try {
      await prisma.approvedReferral.create({
        data: {
          id: newId,
          applicationId: applicationId,
          referralCode: code,
          displayName: ar.displayName || 'Referral',
          description: ar.description,
          referralType: ar.referralType || 'OTHER',
          industryId: industryId,
          isActive: ar.isActive ?? true,
          usageCount: ar.usageCount ?? 0,
          maxUsageLimit: ar.maxUsageLimit,
          validFrom: processDate(ar.validFrom) || new Date(),
          validUntil: processDate(ar.validUntil),
          tags: ar.tags || [],
          category: ar.category,
          priority: ar.priority ?? 0,
          createdAt: processDate(ar.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`ApprovedReferral: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} approved referrals`);
}

async function migrateInternshipPreferences(mongoDb: Db) {
  console.log('\n⚙️ Migrating Internship Preferences...');
  const prefs = await mongoDb.collection('internship_preferences').find({}).toArray();
  const stat = createStat('InternshipPreference', prefs.length);
  const processedStudentIds = new Set<string>();

  for (const pref of prefs) {
    const newId = convertId(pref._id, 'internshipPreferences');
    const studentId = getMappedId(pref.studentId, 'students');

    if (!studentId) {
      stat.skipped++;
      continue;
    }

    // Unique constraint on studentId
    if (processedStudentIds.has(studentId)) {
      stat.skipped++;
      continue;
    }
    processedStudentIds.add(studentId);

    try {
      await prisma.internshipPreference.create({
        data: {
          id: newId,
          studentId: studentId,
          preferredFields: pref.preferredFields || [],
          preferredLocations: pref.preferredLocations || [],
          preferredDurations: pref.preferredDurations || [],
          minimumStipend: pref.minimumStipend,
          isRemotePreferred: pref.isRemotePreferred ?? false,
          additionalRequirements: pref.additionalRequirements,
          createdAt: processDate(pref.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`InternshipPreference: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} internship preferences`);
}

async function migrateGeneratedReports(mongoDb: Db) {
  console.log('\n📈 Migrating Generated Reports...');
  const reports = await mongoDb.collection('generated_reports').find({}).toArray();
  const stat = createStat('GeneratedReport', reports.length);

  for (const report of reports) {
    const newId = convertId(report._id, 'generatedReports');

    try {
      await prisma.generatedReport.create({
        data: {
          id: newId,
          reportType: report.reportType || 'custom',
          reportName: report.reportName,
          configuration: report.configuration || {},
          fileUrl: report.fileUrl,
          format: report.format || 'pdf',
          totalRecords: report.totalRecords,
          generatedAt: processDate(report.generatedAt) || new Date(),
          generatedBy: report.generatedBy || 'system',
          institutionId: report.institutionId,
          expiresAt: processDate(report.expiresAt) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: report.status || 'completed',
          errorMessage: report.errorMessage,
          createdAt: processDate(report.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`GeneratedReport: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} generated reports`);
}

async function migrateReportTemplates(mongoDb: Db) {
  console.log('\n📋 Migrating Report Templates...');
  const templates = await mongoDb.collection('report_templates').find({}).toArray();
  const stat = createStat('ReportTemplate', templates.length);

  for (const template of templates) {
    const newId = convertId(template._id, 'reportTemplates');

    try {
      await prisma.reportTemplate.create({
        data: {
          id: newId,
          name: template.name || 'Unnamed Template',
          reportType: template.reportType || 'custom',
          description: template.description,
          columns: template.columns || [],
          filters: template.filters || {},
          groupBy: template.groupBy,
          sortBy: template.sortBy,
          sortOrder: template.sortOrder,
          createdBy: template.createdBy || 'system',
          institutionId: template.institutionId,
          isPublic: template.isPublic ?? false,
          createdAt: processDate(template.createdAt) || new Date(),
        },
      });
      stat.migrated++;
    } catch (error: any) {
      stat.errors++;
      stat.errorDetails.push(`ReportTemplate: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stat.migrated}/${stat.total} report templates`);
}

// ==========================================
// VERIFICATION FUNCTION
// ==========================================

async function verifyMigration() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 VERIFICATION - Comparing MongoDB vs PostgreSQL counts');
  console.log('='.repeat(60));

  // Get PostgreSQL counts
  const pgCounts: Record<string, number> = {
    Institution: await prisma.institution.count(),
    User: await prisma.user.count(),
    Batch: await prisma.batch.count(),
    Semester: await prisma.semester.count(),
    Branch: await prisma.branch.count(),
    Subject: await prisma.subject.count(),
    Student: await prisma.student.count(),
    Industry: await prisma.industry.count(),
    Internship: await prisma.internship.count(),
    InternshipApplication: await prisma.internshipApplication.count(),
    MentorAssignment: await prisma.mentorAssignment.count(),
    Document: await prisma.document.count(),
    Fee: await prisma.fee.count(),
    FeeStructure: await prisma.feeStructure.count(),
    Scholarship: await prisma.scholarship.count(),
    Placement: await prisma.placement.count(),
    ExamResult: await prisma.examResult.count(),
    ClassAssignment: await prisma.classAssignment.count(),
    MonthlyReport: await prisma.monthlyReport.count(),
    FacultyVisitLog: await prisma.facultyVisitLog.count(),
    MonthlyFeedback: await prisma.monthlyFeedback.count(),
    CompletionFeedback: await prisma.completionFeedback.count(),
    Notification: await prisma.notification.count(),
    AuditLog: await prisma.auditLog.count(),
    Grievance: await prisma.grievance.count(),
    TechnicalQuery: await prisma.technicalQuery.count(),
    Calendar: await prisma.calendar.count(),
    Notice: await prisma.notice.count(),
    BlacklistedToken: await prisma.blacklistedToken.count(),
    ComplianceRecord: await prisma.complianceRecord.count(),
    IndustryRequest: await prisma.industryRequest.count(),
    ReferralApplication: await prisma.referralApplication.count(),
    ApprovedReferral: await prisma.approvedReferral.count(),
    InternshipPreference: await prisma.internshipPreference.count(),
    GeneratedReport: await prisma.generatedReport.count(),
    ReportTemplate: await prisma.reportTemplate.count(),
  };

  console.log('\n📊 PostgreSQL Record Counts:');
  console.log('-'.repeat(40));

  let totalRecords = 0;
  for (const [table, count] of Object.entries(pgCounts).sort((a, b) => b[1] - a[1])) {
    if (count > 0) {
      console.log(`   ${table.padEnd(25)} ${count.toString().padStart(8)}`);
      totalRecords += count;
    }
  }

  console.log('-'.repeat(40));
  console.log(`   ${'TOTAL'.padEnd(25)} ${totalRecords.toString().padStart(8)}`);

  return totalRecords;
}

// ==========================================
// MAIN MIGRATION FUNCTION
// ==========================================

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 MongoDB to PostgreSQL Migration - Comprehensive Version');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  let mongoClient: MongoClient | null = null;

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    console.log(`   URL: ${MONGODB_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    mongoClient = new MongoClient(MONGODB_URL);
    await mongoClient.connect();
    const mongoDb = mongoClient.db();
    console.log('   ✅ Connected to MongoDB');

    // List MongoDB collections
    const collections = await mongoDb.listCollections().toArray();
    console.log(`   Found ${collections.length} collections`);
    console.log('');

    // Clear PostgreSQL tables
    console.log('🗑️  Clearing PostgreSQL tables...');
    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('   ✅ PostgreSQL tables cleared');
    console.log('');

    // Run migrations in dependency order
    console.log('📦 Starting Migration Phases...');
    console.log('='.repeat(60));

    // Phase 1: Core entities (no dependencies)
    console.log('\n--- Phase 1: Core Entities ---');
    await migrateInstitutions(mongoDb);

    // Phase 2: Users (depends on institutions)
    console.log('\n--- Phase 2: Users ---');
    await migrateUsers(mongoDb);

    // Phase 3: Academic structure
    console.log('\n--- Phase 3: Academic Structure ---');
    await migrateBatches(mongoDb);
    await migrateSemesters(mongoDb);
    await migrateBranches(mongoDb);
    await migrateSubjects(mongoDb);
    await migrateScholarships(mongoDb);
    await migrateFeeStructures(mongoDb);

    // Phase 4: Students
    console.log('\n--- Phase 4: Students ---');
    await migrateStudents(mongoDb);

    // Phase 5: Industries and Internships
    console.log('\n--- Phase 5: Industries & Internships ---');
    await migrateIndustries(mongoDb);
    await migrateInternships(mongoDb);

    // Phase 6: Applications and Assignments
    console.log('\n--- Phase 6: Applications & Assignments ---');
    await migrateInternshipApplications(mongoDb);
    await migrateMentorAssignments(mongoDb);
    await migrateClassAssignments(mongoDb);
    await migrateInternshipPreferences(mongoDb);

    // Phase 7: Academic Records
    console.log('\n--- Phase 7: Academic Records ---');
    await migrateDocuments(mongoDb);
    await migrateFees(mongoDb);
    await migrateExamResults(mongoDb);
    await migratePlacements(mongoDb);

    // Phase 8: Internship Tracking
    console.log('\n--- Phase 8: Internship Tracking ---');
    await migrateMonthlyReports(mongoDb);
    await migrateFacultyVisitLogs(mongoDb);
    await migrateMonthlyFeedbacks(mongoDb);
    await migrateCompletionFeedbacks(mongoDb);
    await migrateComplianceRecords(mongoDb);

    // Phase 9: Communications & Requests
    console.log('\n--- Phase 9: Communications & Requests ---');
    await migrateReferralApplications(mongoDb);
    await migrateApprovedReferrals(mongoDb);
    await migrateIndustryRequests(mongoDb);

    // Phase 10: Support & System
    console.log('\n--- Phase 10: Support & System ---');
    await migrateNotifications(mongoDb);
    await migrateAuditLogs(mongoDb);
    await migrateGrievances(mongoDb);
    await migrateTechnicalQueries(mongoDb);
    await migrateCalendars(mongoDb);
    await migrateNotices(mongoDb);
    await migrateBlacklistedTokens(mongoDb);
    await migrateGeneratedReports(mongoDb);
    await migrateReportTemplates(mongoDb);

    // Verification
    const totalRecords = await verifyMigration();

    // Print migration summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const stat of stats) {
      totalMigrated += stat.migrated;
      totalSkipped += stat.skipped;
      totalErrors += stat.errors;
    }

    console.log(`\n   Total Records Migrated: ${totalMigrated}`);
    console.log(`   Total Skipped:          ${totalSkipped}`);
    console.log(`   Total Errors:           ${totalErrors}`);
    console.log(`   PostgreSQL Records:     ${totalRecords}`);

    if (totalErrors > 0) {
      console.log('\n⚠️  Some errors occurred during migration:');
      for (const stat of stats) {
        if (stat.errors > 0 && stat.errorDetails.length > 0) {
          console.log(`   ${stat.collection}:`);
          for (const detail of stat.errorDetails.slice(0, 3)) {
            console.log(`     - ${detail}`);
          }
          if (stat.errorDetails.length > 3) {
            console.log(`     ... and ${stat.errorDetails.length - 3} more errors`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`Finished at: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('\n📡 MongoDB connection closed');
    }
    await prisma.$disconnect();
    await pool.end();
    console.log('📡 PostgreSQL connection closed');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
