const { PrismaClient } = require('../src/generated/prisma/client');

async function deleteFromPostgres() {
  const prisma = new PrismaClient();

  // Find and delete student with email 230225302486@student.edu
  const student = await prisma.student.findFirst({
    where: { email: '230225302486@student.edu' }
  });

  if (student) {
    await prisma.student.delete({ where: { id: student.id } });
    console.log('Deleted student from PostgreSQL:', student.name);
  } else {
    console.log('Student not found in PostgreSQL');
  }

  // Find and delete user
  const user = await prisma.user.findFirst({
    where: { email: '230225302486@student.edu' }
  });

  if (user) {
    await prisma.user.delete({ where: { id: user.id } });
    console.log('Deleted user from PostgreSQL:', user.name);
  } else {
    console.log('User not found in PostgreSQL');
  }

  await prisma.$disconnect();
}

deleteFromPostgres().catch(console.error);
