/**
 * Remove all suppliers and dependent procurement/product links.
 * Run: node scripts/clear-suppliers.mjs
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function clearSuppliers() {
  console.log('Removing all suppliers and dependent records...\n');

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
    counts.products = (await tx.product.deleteMany()).count;
    counts.suppliers = (await tx.supplier.deleteMany()).count;

    return counts;
  });

  for (const [table, count] of Object.entries(result)) {
    if (count > 0) console.log(`  ${table}: ${count} deleted`);
  }

  const remaining = await prisma.supplier.count();
  console.log(`\nSuppliers remaining: ${remaining}`);
}

clearSuppliers()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
