import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma client with pg adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Starting STATE_DIRECTORATE user seed...');

  const email = 'dtepunjab.internship@gmail.com';
  const password = 'Dtepunjab@directorate';
  
  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log('⚠️  User with this email already exists. Updating...');
    
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        name: 'DTEP Punjab Directorate',
        role: 'STATE_DIRECTORATE',
        active: true,
        phoneNo: '+91-172-2700123',
        designation: 'State Directorate Admin',
      },
    });

    console.log('✅ User updated successfully!');
    console.log('📧 Email:', updatedUser.email);
    console.log('👤 Name:', updatedUser.name);
    console.log('🔑 Role:', updatedUser.role);
    console.log('🆔 ID:', updatedUser.id);
  } else {
    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'DTE Punjab Directorate',
        role: 'STATE_DIRECTORATE',
        active: true,
        phoneNo: '+91-172-2700123',
        designation: 'State Directorate Admin',
      },
    });

    console.log('✅ STATE_DIRECTORATE user created successfully!');
    console.log('📧 Email:', newUser.email);
    console.log('👤 Name:', newUser.name);
    console.log('🔑 Role:', newUser.role);
    console.log('🆔 ID:', newUser.id);
  }

  console.log('\n🔐 Login Credentials:');
  console.log('   Email: dtepunjab.internship@gmail.com');
  console.log('   Password: Dtepunjab@directorate');

  // Create 2023-2026 batch
  await seedBatch();
}

async function seedBatch() {
  console.log('\n📚 Creating 2023-2026 batch...');

  const batchName = '2023-2026';

  // Check if batch already exists
  const existingBatch = await prisma.batch.findUnique({
    where: { name: batchName },
  });

  if (existingBatch) {
    console.log('⚠️  Batch 2023-2026 already exists.');
    console.log('🆔 Batch ID:', existingBatch.id);
    console.log('📛 Batch Name:', existingBatch.name);
    console.log('✅ Active:', existingBatch.isActive);
    return existingBatch;
  }

  // Create new batch
  const newBatch = await prisma.batch.create({
    data: {
      name: batchName,
      isActive: true,
    },
  });

  console.log('✅ Batch created successfully!');
  console.log('🆔 Batch ID:', newBatch.id);
  console.log('📛 Batch Name:', newBatch.name);
  console.log('✅ Active:', newBatch.isActive);

  return newBatch;
}

main()
  .catch((e) => {
    console.error('❌ Error seeding STATE_DIRECTORATE user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
