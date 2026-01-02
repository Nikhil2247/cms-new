/**
 * Query PostgreSQL to find details about the duplicate situation
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');
const zlib = require('zlib');
require('dotenv').config();

// Known duplicate student roll numbers
const duplicateRollNumbers = ['230225302486', '230225380589'];

// Known failed record MongoDB IDs
const failedAppId = '6954f3d2aac450a73d42992a';
const failedMentorAssignmentIds = [
  '69490caf5472768221596d07',
  '69490caf5472768221596d08',
  '69490caf5472768221596d16',
  '69490caf5472768221596d17',
];

// Duplicate student MongoDB IDs
const duplicateStudentMongoIds = [
  '69428b3e70d33658be9a7f54',
  '69428b3e70d33658be9a7f55',
];

async function main() {
  // Setup Prisma with pg adapter
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('═'.repeat(80));
  console.log('  POSTGRESQL DATABASE ANALYSIS');
  console.log('═'.repeat(80));

  // Find students with the duplicate roll numbers
  console.log('\n┌─ MIGRATED STUDENTS (ones that were kept)');
  console.log('│');

  for (const rollNumber of duplicateRollNumbers) {
    const student = await prisma.student.findFirst({
      where: { rollNumber },
    });

    if (student) {
      const user = await prisma.user.findUnique({ where: { id: student.userId } });
      const institution = student.institutionId ? await prisma.institution.findUnique({ where: { id: student.institutionId } }) : null;

      console.log(`│  ┌── Roll Number: ${student.rollNumber}`);
      console.log(`│  │   PostgreSQL ID: ${student.id}`);
      console.log(`│  │   Name: ${student.name}`);
      console.log(`│  │   Email: ${student.email}`);
      console.log(`│  │   Contact: ${student.contact}`);
      console.log(`│  │   Branch: ${student.branchName}`);
      console.log(`│  │   Current Year: ${student.currentYear}`);
      console.log(`│  │   Current Semester: ${student.currentSemester}`);
      console.log(`│  │   Is Active: ${student.isActive}`);
      console.log(`│  │   Created At: ${student.createdAt}`);
      console.log(`│  │`);
      console.log(`│  │   User Email: ${user?.email}`);
      console.log(`│  │   User Role: ${user?.role}`);
      console.log(`│  │   Institution: ${institution?.name}`);
      console.log(`│  └──`);
    } else {
      console.log(`│  ⚠ No student found with roll number: ${rollNumber}`);
    }
  }
  console.log('└─');

  // Check if any students exist with similar info
  console.log('\n┌─ CHECKING FOR ANY RELATED STUDENTS');
  console.log('│');

  const allStudents = await prisma.student.findMany({
    where: {
      OR: [
        { rollNumber: { in: duplicateRollNumbers } },
        { rollNumber: { contains: '23022530' } },
        { rollNumber: { contains: '23022538' } },
      ],
    },
    orderBy: { rollNumber: 'asc' },
  });

  console.log(`│  Found ${allStudents.length} related students:`);
  for (const s of allStudents) {
    console.log(`│    - ${s.rollNumber}: ${s.name} (${s.email})`);
  }
  console.log('└─');

  // Check internship applications for these students
  console.log('\n┌─ INTERNSHIP APPLICATIONS FOR THESE STUDENTS');
  console.log('│');

  for (const student of allStudents) {
    const apps = await prisma.internshipApplication.findMany({
      where: { studentId: student.id },
    });

    console.log(`│  ${student.rollNumber}: ${apps.length} applications`);
    for (const app of apps) {
      console.log(`│    - Status: ${app.status}, Company: ${app.companyName || 'N/A'}, Applied: ${app.appliedDate}`);
    }
  }
  console.log('└─');

  // Check mentor assignments for these students
  console.log('\n┌─ MENTOR ASSIGNMENTS FOR THESE STUDENTS');
  console.log('│');

  for (const student of allStudents) {
    const assignments = await prisma.mentorAssignment.findMany({
      where: { studentId: student.id },
    });

    console.log(`│  ${student.rollNumber}: ${assignments.length} mentor assignments`);
    for (const a of assignments) {
      const mentor = await prisma.user.findUnique({ where: { id: a.mentorId } });
      console.log(`│    - Mentor: ${mentor?.name}, Active: ${a.isActive}, Assigned: ${a.assignmentDate}`);
    }
  }
  console.log('└─');

  // Parse MongoDB backup for more details
  console.log('\n' + '═'.repeat(80));
  console.log('  MONGODB BACKUP ANALYSIS');
  console.log('═'.repeat(80));

  const backupPath = 'D:\\Github\\New folder\\cms-new\\prisma backup\\mongodb_backup_2026-01-02_01-30-52.gz';

  console.log('\nReading and parsing backup...');
  const compressed = fs.readFileSync(backupPath);
  const decompressed = zlib.gunzipSync(compressed);

  const BSON = require('bson');

  // Parse all BSON documents
  const allDocs = [];
  let offset = 0;

  while (offset < decompressed.length - 4) {
    const docSize = decompressed.readInt32LE(offset);

    if (docSize < 5 || docSize > 16 * 1024 * 1024 || offset + docSize > decompressed.length) {
      offset++;
      continue;
    }

    if (decompressed[offset + docSize - 1] !== 0) {
      offset++;
      continue;
    }

    try {
      const docBuffer = decompressed.slice(offset, offset + docSize);
      const doc = BSON.deserialize(docBuffer, { promoteBuffers: true });
      if (doc._id) allDocs.push(doc);
      offset += docSize;
    } catch (e) {
      offset++;
    }
  }

  console.log(`Parsed ${allDocs.length} documents from backup\n`);

  const getIdString = (id) => {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (id.toHexString) return id.toHexString();
    return String(id);
  };

  // Find students with those MongoDB IDs or roll numbers
  const duplicateStudents = allDocs.filter(doc =>
    duplicateStudentMongoIds.includes(getIdString(doc._id)) ||
    duplicateRollNumbers.includes(doc.rollNumber)
  );

  // Find all students that share the same userId
  const duplicateUserIds = new Set();
  for (const s of duplicateStudents) {
    if (s.userId) duplicateUserIds.add(getIdString(s.userId));
  }

  // Find all students with those userIds
  const studentsWithSameUserId = allDocs.filter(doc =>
    doc.rollNumber !== undefined && duplicateUserIds.has(getIdString(doc.userId))
  );

  // Group by userId
  const groupedByUserId = {};
  for (const student of studentsWithSameUserId) {
    const uid = getIdString(student.userId);
    if (!groupedByUserId[uid]) groupedByUserId[uid] = [];
    groupedByUserId[uid].push(student);
  }

  console.log('┌─ DUPLICATE STUDENTS FROM MONGODB BACKUP');
  console.log('│');

  for (const [userId, students] of Object.entries(groupedByUserId)) {
    console.log(`│`);
    console.log(`│  User ID: ${userId}`);

    // Find the user
    const user = allDocs.find(doc => getIdString(doc._id) === userId && doc.password !== undefined);
    if (user) {
      console.log(`│  User Email: ${user.email}`);
      console.log(`│  User Name: ${user.firstName || ''} ${user.lastName || ''} ${user.name || ''}`);
      console.log(`│  User Role: ${user.role}`);
    }

    console.log(`│`);
    console.log(`│  Students sharing this User ID (${students.length} total):`);

    for (const student of students) {
      const mongoId = getIdString(student._id);
      const isSkipped = duplicateStudentMongoIds.includes(mongoId);

      console.log(`│  ┌──────────────────────────────────────────────────────────────`);
      console.log(`│  │ MongoDB ID: ${mongoId}${isSkipped ? ' [SKIPPED - DUPLICATE]' : ' [MIGRATED]'}`);
      console.log(`│  │ Roll Number: ${student.rollNumber}`);
      console.log(`│  │ Admission Number: ${student.admissionNumber}`);
      console.log(`│  │ Name: ${student.name}`);
      console.log(`│  │ Email: ${student.email}`);
      console.log(`│  │ Contact: ${student.contact}`);
      console.log(`│  │ Branch: ${student.branchName}`);
      console.log(`│  │ Year/Semester: ${student.currentYear}/${student.currentSemester}`);
      console.log(`│  │ Is Active: ${student.isActive}`);
      console.log(`│  │ Created At: ${student.createdAt}`);
      console.log(`│  └──────────────────────────────────────────────────────────────`);
    }
  }
  console.log('└─');

  // Find the failed internship application
  console.log('\n┌─ FAILED INTERNSHIP APPLICATION FROM MONGODB');
  console.log('│');

  const failedApp = allDocs.find(doc => getIdString(doc._id) === failedAppId);

  if (failedApp) {
    const studentId = getIdString(failedApp.studentId);
    const student = allDocs.find(doc => getIdString(doc._id) === studentId && doc.rollNumber !== undefined);

    console.log(`│  MongoDB ID: ${getIdString(failedApp._id)}`);
    console.log(`│  Status: ${failedApp.status}`);
    console.log(`│  Application Date: ${failedApp.applicationDate || failedApp.appliedDate}`);
    console.log(`│  Company: ${failedApp.companyName || 'N/A'}`);
    console.log(`│  Is Self Identified: ${failedApp.isSelfIdentified}`);
    console.log(`│  Internship Status: ${failedApp.internshipStatus}`);
    console.log(`│  Start Date: ${failedApp.startDate}`);
    console.log(`│  End Date: ${failedApp.endDate}`);
    console.log(`│  Stipend: ${failedApp.stipend}`);
    console.log(`│  Job Profile: ${failedApp.jobProfile}`);
    console.log(`│  HR Name: ${failedApp.hrName}`);
    console.log(`│  HR Email: ${failedApp.hrEmail}`);
    console.log(`│  Company Address: ${failedApp.companyAddress}`);
    console.log(`│`);
    console.log(`│  Student MongoDB ID: ${studentId}`);
    if (student) {
      console.log(`│  → Student Name: ${student.name}`);
      console.log(`│  → Roll Number: ${student.rollNumber}`);
      console.log(`│  → Email: ${student.email}`);
    }
  } else {
    console.log(`│  ⚠ Application not found in backup`);
  }
  console.log('└─');

  // Find the failed mentor assignments
  console.log('\n┌─ FAILED MENTOR ASSIGNMENTS FROM MONGODB');
  console.log('│');

  for (const assignId of failedMentorAssignmentIds) {
    const assign = allDocs.find(doc => getIdString(doc._id) === assignId);

    if (assign) {
      const studentId = getIdString(assign.studentId);
      const mentorUserId = getIdString(assign.mentorId);

      const student = allDocs.find(doc => getIdString(doc._id) === studentId && doc.rollNumber !== undefined);
      const mentor = allDocs.find(doc => getIdString(doc._id) === mentorUserId && doc.password !== undefined);

      console.log(`│`);
      console.log(`│  ┌── Assignment MongoDB ID: ${getIdString(assign._id)}`);
      console.log(`│  │   Assignment Date: ${assign.assignmentDate}`);
      console.log(`│  │   Assignment Reason: ${assign.assignmentReason || 'N/A'}`);
      console.log(`│  │   Academic Year: ${assign.academicYear}`);
      console.log(`│  │   Semester: ${assign.semester}`);
      console.log(`│  │   Is Active: ${assign.isActive}`);
      console.log(`│  │`);
      console.log(`│  │   Student MongoDB ID: ${studentId}`);
      if (student) {
        console.log(`│  │   → Student Name: ${student.name}`);
        console.log(`│  │   → Roll Number: ${student.rollNumber}`);
      }
      console.log(`│  │`);
      console.log(`│  │   Mentor MongoDB ID: ${mentorUserId}`);
      if (mentor) {
        console.log(`│  │   → Mentor Name: ${mentor.firstName || ''} ${mentor.lastName || ''} ${mentor.name || ''}`);
        console.log(`│  │   → Mentor Email: ${mentor.email}`);
        console.log(`│  │   → Mentor Role: ${mentor.role}`);
      }
      console.log(`│  └──`);
    }
  }
  console.log('└─');

  console.log('\n' + '═'.repeat(80));
  console.log('  SUMMARY & RECOMMENDATIONS');
  console.log('═'.repeat(80));
  console.log(`
The MongoDB backup contains duplicate student records that share the same userId.
PostgreSQL enforces a unique constraint on userId in the students table.

Root cause: The MongoDB database allowed multiple student records for the same user,
which is a data integrity issue.

Impact:
- 2 duplicate student records were skipped during migration
- 1 internship application referencing a skipped student failed
- 4 mentor assignments referencing skipped students failed

These records were NOT migrated because they reference student records that
don't exist in PostgreSQL (they were skipped as duplicates).
`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
