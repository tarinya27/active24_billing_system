/**
 * Zero stock and transactional data for go-live migration.
 * Keeps: users, settings, products, categories, suppliers, customers (Walk-in + others).
 * Clears: stock units, GRNs, purchase/sales invoices, POs, stock movements.
 * Run: npm run db:zero-stock
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function zeroStock() {
  console.log('Zeroing stock and transactional data (masters kept)...\n');

  const result = await prisma.$transaction(async (tx) => {
    const counts = {};

    counts.invoicePayments = (await tx.invoicePayment.deleteMany()).count;
    counts.invoiceItems = (await tx.invoiceItem.deleteMany()).count;
    counts.invoices = (await tx.invoice.deleteMany()).count;
    counts.stockMovements = (await tx.stockMovement.deleteMany()).count;
    counts.productUnits = (await tx.productUnit.deleteMany()).count;
    counts.grnItems = (await tx.grnItem.deleteMany()).count;
    counts.grns = (await tx.grn.deleteMany()).count;
    counts.purchaseInvoiceItems = (await tx.purchaseInvoiceItem.deleteMany()).count;
    counts.purchaseInvoices = (await tx.purchaseInvoice.deleteMany()).count;
    counts.poItems = (await tx.poItem.deleteMany()).count;
    counts.purchaseOrders = (await tx.purchaseOrder.deleteMany()).count;
    counts.activities = (await tx.activity.deleteMany()).count;

    return counts;
  });

  for (const [table, count] of Object.entries(result)) {
    if (count > 0) console.log(`  ${table}: ${count} deleted`);
  }

  const kept = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.supplier.count(),
    prisma.category.count(),
    prisma.customer.count(),
  ]);

  console.log('\nKept:');
  console.log(`  users: ${kept[0]}`);
  console.log(`  products: ${kept[1]}`);
  console.log(`  suppliers: ${kept[2]}`);
  console.log(`  categories: ${kept[3]}`);
  console.log(`  customers: ${kept[4]}`);
  console.log('\nStock is now 0. Enter purchase invoices → GRN → sales invoices.');
}

zeroStock()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
