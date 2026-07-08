/**
 * Remove all transactional and master test data while preserving:
 * - Schema, settings, seed system users, walk-in customer
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const PRESERVED_USER_EMAILS = [
  'manager@active24.lk',
  'admin@active24.lk',
  'cashier@active24.lk',
];

const PRESERVED_CUSTOMER_NAMES = ['Walk-in Customer'];

async function countAll() {
  return {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    suppliers: await prisma.supplier.count(),
    customers: await prisma.customer.count(),
    products: await prisma.product.count(),
    productUnits: await prisma.productUnit.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    purchaseInvoices: await prisma.purchaseInvoice.count(),
    grns: await prisma.grn.count(),
    invoices: await prisma.invoice.count(),
    invoicePayments: await prisma.invoicePayment.count(),
    stockMovements: await prisma.stockMovement.count(),
    activities: await prisma.activity.count(),
    settings: await prisma.settings.count(),
  };
}

async function cleanup() {
  const before = await countAll();
  console.log('Counts before cleanup:', before);

  const result = await prisma.$transaction(async (tx) => {
    const deleted = {};

    deleted.invoicePayments = (await tx.invoicePayment.deleteMany()).count;
    deleted.invoiceItems = (await tx.invoiceItem.deleteMany()).count;
    deleted.invoices = (await tx.invoice.deleteMany()).count;
    deleted.stockMovements = (await tx.stockMovement.deleteMany()).count;
    deleted.productUnits = (await tx.productUnit.deleteMany()).count;
    deleted.grnItems = (await tx.grnItem.deleteMany()).count;
    deleted.grns = (await tx.grn.deleteMany()).count;
    deleted.purchaseInvoiceItems = (await tx.purchaseInvoiceItem.deleteMany()).count;
    deleted.purchaseInvoices = (await tx.purchaseInvoice.deleteMany()).count;
    deleted.poItems = (await tx.poItem.deleteMany()).count;
    deleted.purchaseOrders = (await tx.purchaseOrder.deleteMany()).count;
    deleted.activities = (await tx.activity.deleteMany()).count;
    deleted.products = (await tx.product.deleteMany()).count;
    deleted.customers = (
      await tx.customer.deleteMany({
        where: { name: { notIn: PRESERVED_CUSTOMER_NAMES } },
      })
    ).count;
    deleted.suppliers = (await tx.supplier.deleteMany()).count;
    deleted.categories = (await tx.category.deleteMany()).count;
    deleted.testUsers = (
      await tx.user.deleteMany({
        where: { email: { notIn: PRESERVED_USER_EMAILS } },
      })
    ).count;

    return deleted;
  });

  const after = await countAll();
  console.log('Deleted:', result);
  console.log('Counts after cleanup:', after);

  const preservedUsers = await prisma.user.findMany({
    select: { email: true, name: true, role: true },
    orderBy: { email: 'asc' },
  });
  const preservedCustomers = await prisma.customer.findMany({
    select: { name: true, type: true },
  });
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  return {
    before,
    deleted: result,
    after,
    preservedUsers,
    preservedCustomers,
    settings: settings
      ? {
          companyName: settings.companyName,
          invoicePrefix: settings.invoicePrefix,
        }
      : null,
  };
}

cleanup()
  .then((summary) => {
    console.log('\n=== Cleanup complete ===');
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
