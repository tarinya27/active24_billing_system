import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const where = {
  OR: [
    { externalRef: { startsWith: 'A24-EXT' } },
    { externalRef: { startsWith: 'GEN-EXT' } },
    { poNumber: { startsWith: 'PO-A24-2026' } },
    { poNumber: { startsWith: 'PO-GEN-2026' } },
  ],
};

await prisma.poItem.deleteMany({ where: { po: where } });
const result = await prisma.purchaseOrder.deleteMany({ where });
console.log(`Removed ${result.count} development mock PO(s).`);
await prisma.$disconnect();
