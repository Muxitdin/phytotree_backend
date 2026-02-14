import 'dotenv/config';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // Get admin Telegram user ID from environment
  const adminTelegramUserId = process.env.ADMIN_TELEGRAM_USER_ID;

  if (!adminTelegramUserId) {
    console.error('ADMIN_TELEGRAM_USER_ID is not set in environment variables');
    console.log('Please set ADMIN_TELEGRAM_USER_ID in your .env file');
    process.exit(1);
  }

  const telegramUserId = BigInt(adminTelegramUserId);

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { telegramUserId },
  });

  if (existingAdmin) {
    console.log(`Admin user already exists with ID: ${existingAdmin.id}`);

    // Update role to ADMIN if not already
    if (existingAdmin.role !== Role.ADMIN) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: Role.ADMIN },
      });
      console.log('Updated user role to ADMIN');
    }
  } else {
    // Create admin user
    const admin = await prisma.user.create({
      data: {
        telegramUserId,
        firstName: 'Admin',
        role: Role.ADMIN,
      },
    });

    console.log(`Created admin user with ID: ${admin.id}`);
    console.log(`Telegram User ID: ${telegramUserId}`);
  }

  // Create sample categories
  const categories = [
    { name: 'Skin Care', slug: 'skin-care' },
    { name: 'Cleansing', slug: 'cleansing' },
    { name: 'Mask Pack', slug: 'mask-pack' },
    { name: 'Sun Care', slug: 'sun-care' },
    { name: 'Body Care', slug: 'body-care' },
    { name: 'Makeup', slug: 'makeup' },
  ];

  for (const category of categories) {
    const existingCategory = await prisma.productCategory.findUnique({
      where: { slug: category.slug },
    });

    if (!existingCategory) {
      await prisma.productCategory.create({
        data: category,
      });
      console.log(`Created category: ${category.name}`);
    } else {
      console.log(`Category already exists: ${category.name}`);
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
