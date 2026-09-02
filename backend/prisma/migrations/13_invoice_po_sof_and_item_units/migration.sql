-- Optional user-entered PO / SOF on sales invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "poNo" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sofNo" TEXT;

-- Multiple serialized units per invoice line
CREATE TABLE IF NOT EXISTS "invoice_item_units" (
    "id" TEXT NOT NULL,
    "invoiceItemId" TEXT NOT NULL,
    "productUnitId" TEXT NOT NULL,

    CONSTRAINT "invoice_item_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_item_units_productUnitId_key" ON "invoice_item_units"("productUnitId");
CREATE INDEX IF NOT EXISTS "invoice_item_units_invoiceItemId_idx" ON "invoice_item_units"("invoiceItemId");

ALTER TABLE "invoice_item_units" DROP CONSTRAINT IF EXISTS "invoice_item_units_invoiceItemId_fkey";
ALTER TABLE "invoice_item_units" ADD CONSTRAINT "invoice_item_units_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "invoice_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_item_units" DROP CONSTRAINT IF EXISTS "invoice_item_units_productUnitId_fkey";
ALTER TABLE "invoice_item_units" ADD CONSTRAINT "invoice_item_units_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "product_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill junction rows from legacy one-unit-per-line items
INSERT INTO "invoice_item_units" ("id", "invoiceItemId", "productUnitId")
SELECT
    'c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
    "id",
    "productUnitId"
FROM "invoice_items"
WHERE "productUnitId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "invoice_item_units" u WHERE u."productUnitId" = "invoice_items"."productUnitId"
  );

-- Allow multiple lines without unique productUnitId on invoice_items
DROP INDEX IF EXISTS "invoice_items_productUnitId_key";
CREATE INDEX IF NOT EXISTS "invoice_items_productUnitId_idx" ON "invoice_items"("productUnitId");
