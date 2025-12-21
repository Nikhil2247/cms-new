import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Same password used in seed file
const PLAIN_PASSWORD = 'password@1234';

async function main() {
  console.log('🔐 Starting password hashing script...\n');

  // Safety check - prevent running in production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR: Cannot run this script in production environment!');
    console.error('Please use a proper password migration strategy for production.');
    process.exit(1);
  }

  console.log('⚠️  WARNING: This will hash all plain-text passwords!');
  console.log('📍 Environment:', process.env.NODE_ENV || 'development');
  console.log('💾 Database:', process.env.DATABASE_URL ? 'Connected' : 'Not configured');
  console.log('\n');

  try {
    // Fetch all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
      },
    });

    console.log(`📊 Found ${allUsers.length} users in database\n`);

    // Hash the password once
    console.log('🔒 Hashing password...');
    const hashedPassword = await bcrypt.hash(PLAIN_PASSWORD, 10);
    console.log('✅ Password hashed successfully\n');

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log('🔄 Processing users...\n');

    for (const user of allUsers) {
      try {
        // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
        const isAlreadyHashed = /^\$2[aby]\$/.test(user.password);

        if (isAlreadyHashed) {
          console.log(`  ⏭️  Skipped: ${user.email} (already hashed)`);
          skippedCount++;
          continue;
        }

        // Check if the plain password matches
        if (user.password === PLAIN_PASSWORD) {
          // Update with hashed password
          await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
          });

          console.log(`  ✅ Updated: ${user.email} (${user.role})`);
          updatedCount++;
        } else {
          // Password is not the expected plain text - skip
          console.log(`  ⚠️  Skipped: ${user.email} (different password)`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`  ❌ Error updating ${user.email}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n');
    console.log('═══════════════════════════════════════');
    console.log('📊 PASSWORD HASHING SUMMARY:');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Successfully hashed: ${updatedCount} users`);
    console.log(`⏭️  Skipped (already hashed): ${skippedCount} users`);
    console.log(`❌ Errors encountered: ${errorCount} users`);
    console.log(`📌 Total users processed: ${allUsers.length}`);
    console.log('═══════════════════════════════════════');
    console.log('\n');

    if (updatedCount > 0) {
      console.log('🎉 Password hashing completed successfully!');
      console.log('ℹ️  Users can now login using:');
      console.log('   - Regular login endpoint: POST /auth/login');
      console.log(`   - Password: ${PLAIN_PASSWORD}`);
      console.log('   - The simple-login endpoint is no longer needed\n');
    } else {
      console.log('ℹ️  No passwords needed hashing. All users already have hashed passwords.\n');
    }
  } catch (error) {
    console.error('❌ Fatal error during password hashing:', error);
    process.exit(1);
  }
}

// Execute script
main()
  .catch((e) => {
    console.error('❌ Error during password hashing:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
