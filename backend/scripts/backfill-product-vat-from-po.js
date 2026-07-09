/**
 * Backfill product.vatPercentage from the most recent linked purchase order.
 * Run: node scripts/backfill-product-vat-from-po.js
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolvePoVatPercentage } from '../src/utils/productVat.js';

dotenv.config();

const prisma = new PrismaClient();

async function backfill() {
  const poItems = await prisma.poItem.findMany({
    include: {
      product: { select: { id: true, code: true, name: true, vatPercentage: true } },
      po: {
        select: {
          poNumber: true,
          vatRate: true,
          orderDate: true,
          supplier: { select: { vatRate: true } },
        },
      },
    },
    orderBy: { po: { orderDate: 'desc' } },
  });

  const latestByProduct = new Map();
  for (const item of poItems) {
    if (!latestByProduct.has(item.productId)) {
      latestByProduct.set(item.productId, item);
    }
  }

  let updated = 0;
  let skipped = 0;

  for (const [productId, item] of latestByProduct) {
    const resolvedVat = resolvePoVatPercentage(item.po.vatRate, item.po.supplier?.vatRate);
    if (resolvedVat === null) {
      console.warn(`[VAT] Skip ${item.product.code}: PO ${item.po.poNumber} has no resolvable VAT`);
      skipped += 1;
      continue;
    }

    const current = Number(item.product.vatPercentage ?? 0);
    if (current === resolvedVat) {
      skipped += 1;
      continue;
    }

    await prisma.product.update({
      where: { id: productId },
      data: { vatPercentage: resolvedVat },
    });
    console.log(
      `[VAT] ${item.product.code}: ${current}% → ${resolvedVat}% (PO ${item.po.poNumber})`
    );
    updated += 1;
  }

  console.log(`\nBackfill complete. Updated: ${updated}, skipped: ${skipped}`);
}

backfill()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
