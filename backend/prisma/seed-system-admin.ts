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
  console.log('🌱 Starting SYSTEM_ADMIN user seed...');

  const email = 'nikhil97798@gmail.com';
  const password = '@Nikhil123kumar';
  
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
        name: 'System Administrator',
        role: 'SYSTEM_ADMIN',
        active: true,
        phoneNo: '+91-9779800000',
        designation: 'System Administrator',
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
        name: 'System Administrator',
        role: 'SYSTEM_ADMIN',
        active: true,
        phoneNo: '+91-9779800000',
        designation: 'System Administrator',
      },
    });

    console.log('✅ SYSTEM_ADMIN user created successfully!');
    console.log('📧 Email:', newUser.email);
    console.log('👤 Name:', newUser.name);
    console.log('🔑 Role:', newUser.role);
    console.log('🆔 ID:', newUser.id);
  }

  console.log('\n🔐 Login Credentials:');
  console.log('   Email: nikhil97798@gmail.com');
  console.log('   Password: @Nikhil123kumar');
  console.log('\n📊 System Admin has access to:');
  console.log('   - Technical Queries Dashboard');
  console.log('   - Audit Logs Monitoring');
  console.log('   - System-wide Analytics');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
