import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES = ['PRINCIPAL', 'TEACHER', 'STUDENT'] as const;
const DEFAULT_PASSWORD = 'password@1234';

async function main() {
  console.log('🔎 Looking up one test user per role...\n');

  for (const role of ROLES) {
    const user = await prisma.user.findFirst({
      where: { role },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        institutionId: true,
        active: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.log(`❌ ${role}: no user found`);
      continue;
    }

    console.log(`✅ ${role}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${DEFAULT_PASSWORD}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Active: ${user.active}`);
    console.log(`   InstitutionId: ${user.institutionId ?? 'N/A'}`);
    console.log('');
  }

  console.log('ℹ️  Note: If you seeded with prisma/seed.ts, run prisma/hash-passwords.ts once so these users can login with password@1234.');
}

main()
  .catch((e) => {
    console.error('❌ Failed to print credentials:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
