/**
 * Remove all demo/seed business data from the database.
 * Keeps: users, settings, Walk-in Customer.
 * Run: npm run db:clear
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function clearDummyData() {
  console.log('Clearing Active24 dummy / transactional data...\n');

  const result = await prisma.$transaction(async (tx) => {
    const counts = {};

    counts.invoicePayments = (await tx.invoicePayment.deleteMany()).count;
    counts.invoiceItems = (await tx.invoiceItem.deleteMany()).count;
    counts.invoices = (await tx.invoice.deleteMany()).count;
    counts.stockMovements = (await tx.stockMovement.deleteMany()).count;
    counts.productUnits = (await tx.productUnit.deleteMany()).count;
    counts.deliveryNoteItems = (await tx.deliveryNoteItem.deleteMany()).count;
    counts.deliveryNotes = (await tx.deliveryNote.deleteMany()).count;
    counts.grnItems = (await tx.grnItem.deleteMany()).count;
    counts.grns = (await tx.grn.deleteMany()).count;
    counts.purchaseInvoiceItems = (await tx.purchaseInvoiceItem.deleteMany()).count;
    counts.purchaseInvoices = (await tx.purchaseInvoice.deleteMany()).count;
    counts.poItems = (await tx.poItem.deleteMany()).count;
    counts.purchaseOrders = (await tx.purchaseOrder.deleteMany()).count;
    counts.activities = (await tx.activity.deleteMany()).count;
    counts.products = (await tx.product.deleteMany()).count;
    counts.customers = (
      await tx.customer.deleteMany({
        where: { name: { not: 'Walk-in Customer' } },
      })
    ).count;
    counts.categories = (await tx.category.deleteMany()).count;
    counts.suppliers = (await tx.supplier.deleteMany()).count;

    return counts;
  });

  for (const [table, count] of Object.entries(result)) {
    if (count > 0) console.log(`  ${table}: ${count} deleted`);
  }

  const kept = await Promise.all([
    prisma.user.count(),
    prisma.customer.count(),
    prisma.settings.count(),
  ]);

  console.log('\nKept:');
  console.log(`  users: ${kept[0]}`);
  console.log(`  customers: ${kept[1]} (Walk-in only)`);
  console.log(`  settings: ${kept[2]}`);
  console.log('\nDummy data cleared. Ready for go-live data entry.');
}

clearDummyData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
