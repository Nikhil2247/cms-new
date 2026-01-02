/**
 * Script to inspect duplicate students and failed records from MongoDB backup
 */

import * as fs from 'fs';
import * as zlib from 'zlib';

const backupPath = process.argv[2] || 'D:\\Github\\New folder\\cms-new\\prisma backup\\mongodb_backup_2026-01-02_01-30-52.gz';

// Target IDs to investigate
const duplicateStudentIds = [
  '69428b3e70d33658be9a7f54', // Roll: 230225302486
  '69428b3e70d33658be9a7f55', // Roll: 230225380589
];

const failedApplicationIds = ['6954f3d2aac450a73d42992a'];

const failedMentorAssignmentIds = [
  '69490caf5472768221596d07',
  '69490caf5472768221596d08',
  '69490caf5472768221596d16',
  '69490caf5472768221596d17',
];

const mentorIds = [
  '69428b7070d33658be9a7f56',
  '69428b7070d33658be9a7f5c',
];

interface ParsedData {
  users: any[];
  students: any[];
  internshipApplications: any[];
  mentorAssignments: any[];
}

function parseMongoArchive(buffer: Buffer): ParsedData {
  const data: ParsedData = {
    users: [],
    students: [],
    internshipApplications: [],
    mentorAssignments: [],
  };

  let bson: any;
  try {
    bson = require('bson');
  } catch {
    console.error('BSON library not found');
    process.exit(1);
  }

  let offset = 0;
  const docs: any[] = [];

  while (offset < buffer.length - 4) {
    try {
      const docSize = buffer.readInt32LE(offset);
      if (docSize <= 0 || docSize > buffer.length - offset) break;

      const docBuffer = buffer.subarray(offset, offset + docSize);
      try {
        const doc = bson.deserialize(docBuffer, { promoteBuffers: true });
        docs.push(doc);
      } catch {}
      offset += docSize;
    } catch {
      offset++;
    }
  }

  // Classify documents
  for (const doc of docs) {
    const keys = Object.keys(doc).sort().join(',');

    if (doc.rollNumber !== undefined || doc.admissionNumber !== undefined) {
      data.students.push(doc);
    } else if (doc.email && doc.role !== undefined) {
      data.users.push(doc);
    } else if (doc.studentId && doc.mentorId && doc.assignmentDate !== undefined) {
      data.mentorAssignments.push(doc);
    } else if (doc.studentId && (doc.applicationDate !== undefined || doc.appliedDate !== undefined)) {
      data.internshipApplications.push(doc);
    }
  }

  return data;
}

function getObjectIdString(id: any): string {
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (id.toString) return id.toString();
  if (id.toHexString) return id.toHexString();
  return String(id);
}

async function main() {
  console.log('Reading backup file...');
  const compressed = fs.readFileSync(backupPath);
  const decompressed = zlib.gunzipSync(compressed);

  console.log('Parsing MongoDB archive...\n');
  const data = parseMongoArchive(decompressed);

  console.log(`Found: ${data.students.length} students, ${data.users.length} users, ${data.internshipApplications.length} applications, ${data.mentorAssignments.length} mentor assignments\n`);

  // Find duplicate students
  console.log('═'.repeat(80));
  console.log('  DUPLICATE STUDENTS DETAILS');
  console.log('═'.repeat(80));

  const duplicateStudents = data.students.filter(s =>
    duplicateStudentIds.includes(getObjectIdString(s._id))
  );

  // Find what userId they share
  const userIdsOfDuplicates = duplicateStudents.map(s => getObjectIdString(s.userId));

  // Find all students with those userIds to see the conflict
  const studentsWithSameUserIds = data.students.filter(s =>
    userIdsOfDuplicates.includes(getObjectIdString(s.userId))
  );

  // Group by userId
  const groupedByUserId: Record<string, any[]> = {};
  for (const student of studentsWithSameUserIds) {
    const uid = getObjectIdString(student.userId);
    if (!groupedByUserId[uid]) groupedByUserId[uid] = [];
    groupedByUserId[uid].push(student);
  }

  for (const [userId, students] of Object.entries(groupedByUserId)) {
    console.log(`\n┌─ User ID: ${userId}`);
    console.log('│');

    // Find the user
    const user = data.users.find(u => getObjectIdString(u._id) === userId);
    if (user) {
      console.log(`│  User Email: ${user.email}`);
      console.log(`│  User Name: ${user.firstName} ${user.lastName}`);
      console.log(`│  User Role: ${user.role}`);
    }

    console.log('│');
    console.log('│  Students sharing this userId:');

    for (const student of students) {
      const isDuplicate = duplicateStudentIds.includes(getObjectIdString(student._id));
      const marker = isDuplicate ? ' [SKIPPED - DUPLICATE]' : ' [MIGRATED]';

      console.log(`│  ┌──────────────────────────────────────────────────────────────`);
      console.log(`│  │ Student MongoDB ID: ${getObjectIdString(student._id)}${marker}`);
      console.log(`│  │ Roll Number: ${student.rollNumber}`);
      console.log(`│  │ Admission Number: ${student.admissionNumber}`);
      console.log(`│  │ Name: ${student.name}`);
      console.log(`│  │ Email: ${student.email}`);
      console.log(`│  │ Contact: ${student.contact}`);
      console.log(`│  │ Branch: ${student.branchName}`);
      console.log(`│  │ Current Year: ${student.currentYear}`);
      console.log(`│  │ Current Semester: ${student.currentSemester}`);
      console.log(`│  │ Is Active: ${student.isActive}`);
      console.log(`│  │ Created At: ${student.createdAt}`);
      console.log(`│  └──────────────────────────────────────────────────────────────`);
    }
    console.log('└─');
  }

  // Failed Internship Applications
  console.log('\n' + '═'.repeat(80));
  console.log('  FAILED INTERNSHIP APPLICATION DETAILS');
  console.log('═'.repeat(80));

  const failedApps = data.internshipApplications.filter(a =>
    failedApplicationIds.includes(getObjectIdString(a._id))
  );

  for (const app of failedApps) {
    const studentId = getObjectIdString(app.studentId);
    const student = data.students.find(s => getObjectIdString(s._id) === studentId);

    console.log(`\n┌─ Application MongoDB ID: ${getObjectIdString(app._id)}`);
    console.log('│');
    console.log(`│  Status: ${app.status}`);
    console.log(`│  Application Date: ${app.applicationDate || app.appliedDate}`);
    console.log(`│  Company: ${app.companyName || 'N/A'}`);
    console.log(`│  Is Self Identified: ${app.isSelfIdentified}`);
    console.log(`│  Internship Status: ${app.internshipStatus}`);
    console.log(`│  Start Date: ${app.startDate}`);
    console.log(`│  End Date: ${app.endDate}`);
    console.log(`│  Stipend: ${app.stipend}`);
    console.log(`│  Job Profile: ${app.jobProfile}`);
    console.log('│');
    console.log(`│  Referenced Student ID: ${studentId}`);
    if (student) {
      console.log(`│    → Student Name: ${student.name}`);
      console.log(`│    → Roll Number: ${student.rollNumber}`);
      console.log(`│    → This student was SKIPPED (duplicate)`);
    }
    console.log('└─');
  }

  // Failed Mentor Assignments
  console.log('\n' + '═'.repeat(80));
  console.log('  FAILED MENTOR ASSIGNMENT DETAILS');
  console.log('═'.repeat(80));

  const failedAssignments = data.mentorAssignments.filter(a =>
    failedMentorAssignmentIds.includes(getObjectIdString(a._id))
  );

  for (const assign of failedAssignments) {
    const studentId = getObjectIdString(assign.studentId);
    const mentorUserId = getObjectIdString(assign.mentorId);

    const student = data.students.find(s => getObjectIdString(s._id) === studentId);
    const mentor = data.users.find(u => getObjectIdString(u._id) === mentorUserId);

    console.log(`\n┌─ Mentor Assignment MongoDB ID: ${getObjectIdString(assign._id)}`);
    console.log('│');
    console.log(`│  Assignment Date: ${assign.assignmentDate}`);
    console.log(`│  Assignment Reason: ${assign.assignmentReason || 'N/A'}`);
    console.log(`│  Academic Year: ${assign.academicYear}`);
    console.log(`│  Semester: ${assign.semester}`);
    console.log(`│  Is Active: ${assign.isActive}`);
    console.log('│');
    console.log(`│  Referenced Student ID: ${studentId}`);
    if (student) {
      console.log(`│    → Student Name: ${student.name}`);
      console.log(`│    → Roll Number: ${student.rollNumber}`);
      console.log(`│    → This student was SKIPPED (duplicate)`);
    }
    console.log('│');
    console.log(`│  Mentor User ID: ${mentorUserId}`);
    if (mentor) {
      console.log(`│    → Mentor Name: ${mentor.firstName} ${mentor.lastName}`);
      console.log(`│    → Mentor Email: ${mentor.email}`);
      console.log(`│    → Mentor Role: ${mentor.role}`);
    }
    console.log('└─');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('  SUMMARY');
  console.log('═'.repeat(80));
  console.log(`
The root cause is that the MongoDB database has 2 student records that share
the same userId with other student records. PostgreSQL enforces uniqueness
on userId, so only one student per userId can be migrated.

The skipped students had internship applications and mentor assignments
that couldn't be migrated because the student records they reference
don't exist in PostgreSQL.

Recommended actions:
1. Investigate why duplicate student records exist in MongoDB
2. Decide which student record should be the "primary" one
3. Manually migrate the failed applications/assignments to the correct student
`);
}

main().catch(console.error);
