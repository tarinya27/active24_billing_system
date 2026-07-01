ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "vatEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Existing invoices with VAT applied on top → mark vatEnabled
UPDATE "purchase_invoices"
SET "vatEnabled" = true
WHERE "vatRate" > 0 AND "purchaseWithVat" = false;
