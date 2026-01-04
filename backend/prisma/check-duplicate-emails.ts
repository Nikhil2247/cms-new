import { MongoClient, ObjectId } from 'mongodb';

async function checkDuplicateStudents() {
  const client = new MongoClient('mongodb://admin:Admin1234@127.0.0.1:27018/internship?authSource=admin&directConnection=true');
  await client.connect();
  const db = client.db('internship');

  // The student IDs from the error
  const studentIds = [
    '69428b3e70d33658be9a7f1e',
    '69428e2a70d33658be9a82de',
    '694290e070d33658be9a86bf'
  ];

  console.log('=== Problem Students with Duplicate Emails ===\n');

  for (const id of studentIds) {
    const student = await db.collection('Student').findOne({ _id: new ObjectId(id) });
    if (student) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Student MongoDB ID:', id);
      console.log('  Name:', student.name);
      console.log('  Email:', student.email);
      console.log('  Roll Number:', student.rollNumber);
      console.log('  User ID (linked):', student.userId?.toString());
      console.log('  Institution ID:', student.institutionId?.toString());
      console.log('');

      // Find the linked user
      if (student.userId) {
        const linkedUser = await db.collection('User').findOne({ _id: new ObjectId(student.userId) });
        if (linkedUser) {
          console.log('  Linked User Details:');
          console.log('    - User ID:', linkedUser._id.toString());
          console.log('    - Name:', linkedUser.name);
          console.log('    - Email:', linkedUser.email);
          console.log('    - Role:', linkedUser.role);
        }
      }

      // Find all users with this student's email
      if (student.email) {
        const usersWithEmail = await db.collection('User').find({
          email: student.email.toLowerCase()
        }).toArray();

        console.log('\n  All Users with email "' + student.email + '":');
        if (usersWithEmail.length === 0) {
          // Try case-insensitive search
          const usersWithEmailCI = await db.collection('User').find({
            email: { $regex: new RegExp(`^${student.email}$`, 'i') }
          }).toArray();

          if (usersWithEmailCI.length > 0) {
            usersWithEmailCI.forEach(u => {
              console.log('    - User ID:', u._id.toString());
              console.log('      Name:', u.name);
              console.log('      Email:', u.email);
              console.log('      Role:', u.role);
              console.log('');
            });
          } else {
            console.log('    (None found)');
          }
        } else {
          usersWithEmail.forEach(u => {
            console.log('    - User ID:', u._id.toString());
            console.log('      Name:', u.name);
            console.log('      Email:', u.email);
            console.log('      Role:', u.role);
            console.log('');
          });
        }
      }
      console.log('');
    }
  }

  // Also check PostgreSQL to see what was actually migrated
  console.log('\n=== Checking PostgreSQL for these students ===\n');

  const { PrismaClient } = require('../src/generated/prisma/client');
  const prisma = new PrismaClient();

  // Find students by roll number
  const rollNumbers = ['230226102539', '231585307158', '231939508283'];

  for (const rollNumber of rollNumbers) {
    const pgUser = await prisma.user.findFirst({
      where: { rollNumber },
      include: { student: true }
    });

    if (pgUser) {
      console.log('PostgreSQL User with rollNumber', rollNumber + ':');
      console.log('  User ID:', pgUser.id);
      console.log('  Name:', pgUser.name);
      console.log('  Email:', pgUser.email);
      console.log('  Role:', pgUser.role);
      console.log('  Has Student record:', !!pgUser.student);
      console.log('');
    } else {
      console.log('No PostgreSQL user found with rollNumber:', rollNumber);
      console.log('');
    }
  }

  await prisma.$disconnect();
  await client.close();
}

checkDuplicateStudents().catch(console.error);
