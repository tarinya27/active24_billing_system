import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function seedUsers() {
  const users = [
    { name: 'System Manager', email: 'manager@active24.lk', role: 'MANAGER', password: process.env.SEED_MANAGER_PASSWORD || 'Manager@123' },
    { name: 'System Admin', email: 'admin@active24.lk', role: 'ADMIN', password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123' },
    { name: 'Front Cashier', email: 'cashier@active24.lk', role: 'CASHIER', password: process.env.SEED_CASHIER_PASSWORD || 'Cashier@123' },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash, isActive: true },
      create: { name: u.name, email: u.email, role: u.role, passwordHash },
    });
  }
  console.log(`Seeded ${users.length} users (manager / admin / cashier).`);
}

async function seedSettings() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: 'Active24 (Pvt) Ltd',
      companyAddress: 'No. 128, Duplication Road, Colombo 04, Sri Lanka',
      companyPhone: '+94 11 456 7890',
      companyEmail: 'info@active24.lk',
      invoicePrefix: 'INV-2026-',
      invoiceNextSeq: 1,
      invoiceNumberPad: 4,
      defaultPaymentMethod: 'CASH',
      vatRate: 0,
      vatEnabled: true,
      currency: 'LKR',
      lowStockThreshold: 10,
    },
  });
  console.log('Seeded settings (single row).');
}

async function seedWalkInCustomer() {
  const existing = await prisma.customer.findFirst({
    where: { name: 'Walk-in Customer', type: 'WALK_IN' },
  });
  if (existing) {
    console.log('Walk-in Customer already exists.');
    return;
  }
  await prisma.customer.create({
    data: {
      name: 'Walk-in Customer',
      mobile: '-',
      address: '-',
      email: '-',
      type: 'WALK_IN',
    },
  });
  console.log('Seeded Walk-in Customer.');
}

async function main() {
  console.log('Seeding Active24 essentials (users, settings, walk-in customer)...');
  await seedUsers();
  await seedSettings();
  await seedWalkInCustomer();
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
