-- AlterTable
CREATE TYPE "InvoiceItemType" AS ENUM ('PRODUCT', 'SERVICE');

ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "itemType" "InvoiceItemType" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "invoice_items" ALTER COLUMN "productUnitId" DROP NOT NULL;
ALTER TABLE "invoice_items" ALTER COLUMN "productId" DROP NOT NULL;
