import { PrismaClient, SystemKey } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Seed system variables
  console.log('Seeding system variables...');

  // Default AVIATOR_CHANCES configuration
  const defaultAviatorChances = [
    { from: 1, to: 2, chance: 70 },
    { from: 2, to: 5, chance: 20 },
    { from: 5, to: 10, chance: 8 },
    { from: 10, to: 20, chance: 2 },
  ];

  await prisma.system.upsert({
    where: { key: SystemKey.AVIATOR_CHANCES },
    update: {},
    create: {
      key: SystemKey.AVIATOR_CHANCES,
      value: JSON.stringify(defaultAviatorChances),
    },
  });
  console.log('✓ AVIATOR_CHANCES seeded');

  await prisma.system.upsert({
    where: { key: SystemKey.WEBAPP_URL },
    update: {},
    create: {
      key: SystemKey.WEBAPP_URL,
      value: process.env.WEBAPP_URL || 'http://localhost:5173',
    },
  });
  console.log('✓ WEBAPP_URL seeded');

  // Note: TELEGRAM_BOT_TOKEN should be set manually via the API for security
  console.log('\nSeeding admin user...');

  // Create test admin user with strong credentials
  const adminLogin = 'superadmin';
  const adminPassword = 'Admin@2024!SecurePass';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.admin.upsert({
    where: { login: adminLogin },
    update: {
      password: hashedPassword,
    },
    create: {
      login: adminLogin,
      password: hashedPassword,
    },
  });

  console.log('✓ Admin user created');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 ADMIN CREDENTIALS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Login:    ${adminLogin}`);
  console.log(`Password: ${adminPassword}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Seeding complete!');
  console.log('Remember to set TELEGRAM_BOT_TOKEN via the admin API endpoint.');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
