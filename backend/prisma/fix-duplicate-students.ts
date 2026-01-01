/**
 * Script to fix duplicate students that were skipped during migration
 * Creates new user accounts for students who shared userId with another student
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { MongoClient, ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const MONGODB_URL = 'mongodb://localhost:27017/internship';
const DATABASE_URL = 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public';

// Set DATABASE_URL
process.env.DATABASE_URL = DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// The duplicate student MongoDB IDs (these were skipped during migration)
const DUPLICATE_STUDENT_IDS = [
  '69428b3e70d33658be9a7f53', // Dharampreet Singh - shared userId with Vishal Singh
  '69428b3e70d33658be9a7f55', // Subham - shared userId with Chandan
  '69428b3e70d33658be9a7f54', // Kulwinder Singh - shared userId with Vivek
  '69428b3e70d33658be9a7f52', // Arman - shared userId with Vikrant Singh
];

async function main() {
  console.log('='.repeat(70));
  console.log('FIXING DUPLICATE STUDENTS - Creating New User Accounts');
  console.log('='.repeat(70));

  const mongoClient = new MongoClient(MONGODB_URL);

  try {
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('Connected to MongoDB\n');

    // Get a default institution ID
    const defaultInstitution = await prisma.institution.findFirst();
    const defaultInstitutionId = defaultInstitution?.id || null;

    for (const studentMongoId of DUPLICATE_STUDENT_IDS) {
      console.log('-'.repeat(70));

      // Get student from MongoDB
      const student = await db.collection('Student').findOne({
        _id: new ObjectId(studentMongoId)
      });

      if (!student) {
        console.log(`Student ${studentMongoId} not found in MongoDB - skipping`);
        continue;
      }

      // Get original user info
      const originalUser = student.userId
        ? await db.collection('User').findOne({ _id: student.userId })
        : null;

      console.log(`\nStudent: ${student.name}`);
      console.log(`  Roll Number: ${student.rollNumber}`);
      console.log(`  Email: ${student.email || 'N/A'}`);
      console.log(`  Original shared userId: ${student.userId}`);
      console.log(`  Original user name: ${originalUser?.name || 'N/A'}`);

      // Check if student already exists in PostgreSQL
      const existingStudent = await prisma.student.findFirst({
        where: { rollNumber: student.rollNumber }
      });

      if (existingStudent) {
        console.log(`  ⚠️  Student with roll ${student.rollNumber} already exists - skipping`);
        continue;
      }

      // Generate new UUIDs
      const newUserId = uuidv4();
      const newStudentId = uuidv4();

      // Determine email for new user
      let newEmail = student.email;
      if (!newEmail || newEmail.trim() === '') {
        newEmail = `${student.rollNumber}@student.generated.edu`;
      }

      // Check if email already exists
      const existingUser = await prisma.user.findFirst({
        where: { email: newEmail }
      });

      if (existingUser) {
        newEmail = `${student.rollNumber}_${Date.now()}@student.generated.edu`;
      }

      console.log(`\n  Creating new records:`);
      console.log(`    New User ID: ${newUserId}`);
      console.log(`    New Student ID: ${newStudentId}`);
      console.log(`    Email: ${newEmail}`);

      // Create new User
      await prisma.user.create({
        data: {
          id: newUserId,
          email: newEmail,
          password: originalUser?.password || 'MIGRATION_PLACEHOLDER',
          name: student.name || 'Unknown',
          role: 'STUDENT',
          active: true,
          institutionId: defaultInstitutionId,
          phoneNo: student.contact,
          rollNumber: student.rollNumber,
          branchName: student.branchName,
          consent: false,
          loginCount: 0,
          hasChangedDefaultPassword: false,
          createdAt: student.createdAt ? new Date(student.createdAt) : new Date(),
        },
      });

      // Create new Student
      await prisma.student.create({
        data: {
          id: newStudentId,
          userId: newUserId,
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
          institutionId: defaultInstitutionId,
          branchName: student.branchName,
          currentYear: student.currentYear,
          currentSemester: student.currentSemester,
          totalBacklogs: student.totalBacklogs || 0,
          admissionType: student.admissionType,
          category: student.category,
          clearanceStatus: student.clearanceStatus || 'PENDING',
          isActive: student.isActive ?? true,
          createdAt: student.createdAt ? new Date(student.createdAt) : new Date(),
        },
      });

      console.log(`  ✅ Successfully created User and Student for ${student.name}`);
    }

    // Verification
    console.log('\n' + '='.repeat(70));
    console.log('VERIFICATION');
    console.log('='.repeat(70));

    const userCount = await prisma.user.count();
    const studentCount = await prisma.student.count();

    console.log(`Total Users in PostgreSQL: ${userCount}`);
    console.log(`Total Students in PostgreSQL: ${studentCount}`);

    // Show the newly created students
    console.log('\nNewly added students:');
    for (const studentMongoId of DUPLICATE_STUDENT_IDS) {
      const mongoStudent = await db.collection('Student').findOne({
        _id: new ObjectId(studentMongoId)
      });
      if (mongoStudent) {
        const pgStudent = await prisma.student.findFirst({
          where: { rollNumber: mongoStudent.rollNumber },
          include: { user: true }
        });
        if (pgStudent) {
          console.log(`  - ${pgStudent.name} (Roll: ${pgStudent.rollNumber})`);
          console.log(`    User ID: ${pgStudent.userId}`);
          console.log(`    User Email: ${pgStudent.user?.email}`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ DUPLICATE STUDENTS FIXED SUCCESSFULLY!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
