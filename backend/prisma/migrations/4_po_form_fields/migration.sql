-- PO form fields (mirror hosted PO system)
CREATE TYPE "PoFulfillmentType" AS ENUM ('DELIVERY', 'COLLECTION');

ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "supplierRefNo" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "attn" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT DEFAULT '30 days';
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "fulfillmentType" "PoFulfillmentType" NOT NULL DEFAULT 'DELIVERY';
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "collectedBy" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "subTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "po_items" ADD COLUMN IF NOT EXISTS "description" TEXT;
