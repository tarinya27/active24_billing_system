import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const result = await prisma.$transaction(async (tx) => {
  const grn = await tx.grn.updateMany({ data: { poId: null }, where: { poId: { not: null } } });
  const pi = await tx.purchaseInvoice.updateMany({ data: { poId: null }, where: { poId: { not: null } } });
  const items = await tx.poItem.deleteMany();
  const pos = await tx.purchaseOrder.deleteMany();
  return {
    grnUnlinked: grn.count,
    purchaseInvoicesUnlinked: pi.count,
    poItemsDeleted: items.count,
    purchaseOrdersDeleted: pos.count,
  };
});

console.log('Purchase orders cleared:', result);
await prisma.$disconnect();
