import { MongoClient } from 'mongodb';
import pg from 'pg';

async function fullIntegrityCheck() {
  const mongoClient = new MongoClient('mongodb://admin:Admin1234@127.0.0.1:27018/internship?authSource=admin&directConnection=true');
  await mongoClient.connect();
  const mongoDb = mongoClient.db('internship');

  const pgPool = new pg.Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public'
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('              COMPREHENSIVE DATA INTEGRITY CHECK');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // =========================================================================
  // 1. RECORD COUNTS
  // =========================================================================
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 1. RECORD COUNTS                                            │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  const collections = [
    { mongo: 'User', pg: 'User' },
    { mongo: 'Student', pg: 'Student' },
    { mongo: 'Institution', pg: 'Institution' },
    { mongo: 'Batch', pg: 'Batch' },
    { mongo: 'internship_applications', pg: 'InternshipApplication' },
    { mongo: 'mentor_assignments', pg: 'MentorAssignment' },
    { mongo: 'Document', pg: 'Document' },
    { mongo: 'Notification', pg: 'Notification' },
    { mongo: 'Grievance', pg: 'Grievance' },
    { mongo: 'AuditLog', pg: 'AuditLog' },
  ];

  let countMismatches: string[] = [];
  for (const col of collections) {
    const mongoCount = await mongoDb.collection(col.mongo).countDocuments();
    const pgResult = await pgPool.query(`SELECT COUNT(*) FROM "${col.pg}"`);
    const pgCount = parseInt(pgResult.rows[0].count);
    const match = mongoCount === pgCount ? '✓' : '✗';
    const diff = pgCount - mongoCount;
    console.log(`${match} ${col.pg.padEnd(25)} MongoDB: ${mongoCount.toString().padStart(5)} | PG: ${pgCount.toString().padStart(5)} | Diff: ${diff}`);
    if (mongoCount !== pgCount) {
      countMismatches.push(`${col.pg}: ${diff > 0 ? '+' : ''}${diff}`);
    }
  }

  // =========================================================================
  // 2. USER DATA SYNC (for students)
  // =========================================================================
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 2. USER DATA SYNC (Student → User fields)                   │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  const mongoStudents = await mongoDb.collection('Student').find({}).toArray();
  const mongoUsers = await mongoDb.collection('User').find({}).toArray();
  const mongoUserMap = new Map(mongoUsers.map(u => [u._id.toString(), u]));

  // Get all PostgreSQL users with students
  const pgStudentUsers = await pgPool.query(`
    SELECT u.id, u.name, u.email, u."rollNumber", u."phoneNo", u.active, u."branchName"
    FROM "User" u
    INNER JOIN "Student" s ON s."userId" = u.id
  `);
  const pgUserMap = new Map(pgStudentUsers.rows.map((u: any) => [u.rollNumber, u]));

  let nameMismatches: any[] = [];
  let emailMismatches: any[] = [];
  let rollMismatches: any[] = [];
  let phoneMismatches: any[] = [];
  let activeMismatches: any[] = [];
  let branchMismatches: any[] = [];

  for (const student of mongoStudents) {
    const pgUser = pgUserMap.get(student.rollNumber);
    if (!pgUser) continue;

    // Name check
    if (student.name && pgUser.name !== student.name) {
      nameMismatches.push({ roll: student.rollNumber, mongo: student.name, pg: pgUser.name });
    }

    // Email check (skip placeholder emails)
    if (student.email && !pgUser.email.endsWith('@student.edu') && pgUser.email.toLowerCase() !== student.email.toLowerCase()) {
      emailMismatches.push({ roll: student.rollNumber, mongo: student.email, pg: pgUser.email });
    }

    // Phone check
    if (student.contact && pgUser.phoneNo !== student.contact) {
      phoneMismatches.push({ roll: student.rollNumber, mongo: student.contact, pg: pgUser.phoneNo });
    }

    // Active check
    const mongoActive = student.isActive !== false;
    if (pgUser.active !== mongoActive) {
      activeMismatches.push({ roll: student.rollNumber, name: student.name, mongo: mongoActive, pg: pgUser.active });
    }

    // Branch check
    if (student.branchName && pgUser.branchName !== student.branchName) {
      branchMismatches.push({ roll: student.rollNumber, mongo: student.branchName, pg: pgUser.branchName });
    }
  }

  console.log(`Name mismatches:     ${nameMismatches.length}`);
  if (nameMismatches.length > 0 && nameMismatches.length <= 5) {
    nameMismatches.forEach(m => console.log(`  - ${m.roll}: "${m.mongo}" vs "${m.pg}"`));
  }

  console.log(`Email mismatches:    ${emailMismatches.length} (excluding placeholder emails)`);
  if (emailMismatches.length > 0 && emailMismatches.length <= 5) {
    emailMismatches.forEach(m => console.log(`  - ${m.roll}: "${m.mongo}" vs "${m.pg}"`));
  }

  console.log(`Phone mismatches:    ${phoneMismatches.length}`);
  if (phoneMismatches.length > 0 && phoneMismatches.length <= 5) {
    phoneMismatches.forEach(m => console.log(`  - ${m.roll}: "${m.mongo}" vs "${m.pg}"`));
  }

  console.log(`Active mismatches:   ${activeMismatches.length}`);
  if (activeMismatches.length > 0) {
    activeMismatches.forEach(m => console.log(`  - ${m.name} (${m.roll}): mongo=${m.mongo}, pg=${m.pg}`));
  }

  console.log(`Branch mismatches:   ${branchMismatches.length}`);
  if (branchMismatches.length > 0 && branchMismatches.length <= 5) {
    branchMismatches.forEach(m => console.log(`  - ${m.roll}: "${m.mongo}" vs "${m.pg}"`));
  }

  // =========================================================================
  // 3. ORPHAN CHECKS
  // =========================================================================
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 3. ORPHAN CHECKS                                            │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Users with role=STUDENT but no Student record
  const orphanedStudentUsers = await pgPool.query(`
    SELECT u.id, u.name, u."rollNumber"
    FROM "User" u
    LEFT JOIN "Student" s ON s."userId" = u.id
    WHERE u.role = 'STUDENT' AND s.id IS NULL
  `);
  console.log(`Orphaned Users (role=STUDENT, no Student): ${orphanedStudentUsers.rows.length}`);

  // Students with no User
  const orphanedStudents = await pgPool.query(`
    SELECT s.id, s."admissionNumber"
    FROM "Student" s
    LEFT JOIN "User" u ON u.id = s."userId"
    WHERE u.id IS NULL
  `);
  console.log(`Orphaned Students (no User):               ${orphanedStudents.rows.length}`);

  // MentorAssignments with missing student
  const orphanedMentorAssignments = await pgPool.query(`
    SELECT ma.id
    FROM "MentorAssignment" ma
    LEFT JOIN "Student" s ON s.id = ma."studentId"
    WHERE s.id IS NULL
  `);
  console.log(`Orphaned MentorAssignments (no Student):   ${orphanedMentorAssignments.rows.length}`);

  // InternshipApplications with missing student
  const orphanedApplications = await pgPool.query(`
    SELECT ia.id
    FROM "InternshipApplication" ia
    LEFT JOIN "Student" s ON s.id = ia."studentId"
    WHERE s.id IS NULL
  `);
  console.log(`Orphaned Applications (no Student):        ${orphanedApplications.rows.length}`);

  // Documents with missing student
  const orphanedDocuments = await pgPool.query(`
    SELECT d.id
    FROM "Document" d
    LEFT JOIN "Student" s ON s.id = d."studentId"
    WHERE d."studentId" IS NOT NULL AND s.id IS NULL
  `);
  console.log(`Orphaned Documents (no Student):           ${orphanedDocuments.rows.length}`);

  // =========================================================================
  // 4. INSTITUTION CHECKS
  // =========================================================================
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 4. INSTITUTION CHECKS                                       │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Students without institution
  const studentsNoInstitution = await pgPool.query(`
    SELECT COUNT(*) FROM "Student" WHERE "institutionId" IS NULL
  `);
  console.log(`Students without institutionId: ${studentsNoInstitution.rows[0].count}`);

  // Users without institution
  const usersNoInstitution = await pgPool.query(`
    SELECT COUNT(*) FROM "User" WHERE "institutionId" IS NULL AND role = 'STUDENT'
  `);
  console.log(`Student Users without institutionId: ${usersNoInstitution.rows[0].count}`);

  // =========================================================================
  // 5. BRANCH CHECKS
  // =========================================================================
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 5. BRANCH CHECKS                                            │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Students without branch
  const studentsNoBranch = await pgPool.query(`
    SELECT COUNT(*) FROM "Student" WHERE "branchId" IS NULL
  `);
  console.log(`Students without branchId: ${studentsNoBranch.rows[0].count}`);

  // Users without branch
  const usersNoBranch = await pgPool.query(`
    SELECT COUNT(*) FROM "User" WHERE "branchId" IS NULL AND role = 'STUDENT'
  `);
  console.log(`Student Users without branchId: ${usersNoBranch.rows[0].count}`);

  // Branch count
  const branchCount = await pgPool.query(`SELECT COUNT(*) FROM "Branch"`);
  console.log(`Total branches created: ${branchCount.rows[0].count}`);

  // =========================================================================
  // 6. DUPLICATE CHECKS
  // =========================================================================
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 6. DUPLICATE CHECKS                                         │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Duplicate emails
  const duplicateEmails = await pgPool.query(`
    SELECT email, COUNT(*) as cnt
    FROM "User"
    WHERE email IS NOT NULL
    GROUP BY email
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate emails: ${duplicateEmails.rows.length}`);
  if (duplicateEmails.rows.length > 0) {
    duplicateEmails.rows.slice(0, 5).forEach((r: any) => console.log(`  - ${r.email}: ${r.cnt} users`));
  }

  // Duplicate roll numbers
  const duplicateRolls = await pgPool.query(`
    SELECT "rollNumber", COUNT(*) as cnt
    FROM "User"
    WHERE "rollNumber" IS NOT NULL AND "rollNumber" != ''
    GROUP BY "rollNumber"
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate roll numbers: ${duplicateRolls.rows.length}`);
  if (duplicateRolls.rows.length > 0) {
    duplicateRolls.rows.slice(0, 5).forEach((r: any) => console.log(`  - ${r.rollNumber}: ${r.cnt} users`));
  }

  // Duplicate admission numbers
  const duplicateAdmissions = await pgPool.query(`
    SELECT "admissionNumber", COUNT(*) as cnt
    FROM "Student"
    WHERE "admissionNumber" IS NOT NULL
    GROUP BY "admissionNumber"
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate admission numbers: ${duplicateAdmissions.rows.length}`);
  if (duplicateAdmissions.rows.length > 0) {
    duplicateAdmissions.rows.slice(0, 5).forEach((r: any) => console.log(`  - ${r.admissionNumber}: ${r.cnt} students`));
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const issues: string[] = [];

  if (countMismatches.length > 0) issues.push(`Count mismatches: ${countMismatches.join(', ')}`);
  if (nameMismatches.length > 0) issues.push(`Name mismatches: ${nameMismatches.length}`);
  if (emailMismatches.length > 0) issues.push(`Email mismatches: ${emailMismatches.length}`);
  if (phoneMismatches.length > 0) issues.push(`Phone mismatches: ${phoneMismatches.length}`);
  if (activeMismatches.length > 0) issues.push(`Active mismatches: ${activeMismatches.length}`);
  if (orphanedStudentUsers.rows.length > 0) issues.push(`Orphaned student users: ${orphanedStudentUsers.rows.length}`);
  if (orphanedStudents.rows.length > 0) issues.push(`Orphaned students: ${orphanedStudents.rows.length}`);
  if (duplicateEmails.rows.length > 0) issues.push(`Duplicate emails: ${duplicateEmails.rows.length}`);
  if (duplicateRolls.rows.length > 0) issues.push(`Duplicate rolls: ${duplicateRolls.rows.length}`);

  if (issues.length === 0) {
    console.log('✓ All checks passed! No issues found.');
  } else {
    console.log('Issues found:');
    issues.forEach(i => console.log(`  ✗ ${i}`));
  }

  await mongoClient.close();
  await pgPool.end();
}

fullIntegrityCheck().catch(console.error);
