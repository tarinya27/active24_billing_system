ALTER TYPE "UnitStatus" ADD VALUE IF NOT EXISTS 'PENDING_GRN';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseInvoiceStatus') THEN
    CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('PENDING', 'RECEIVED');
  END IF;
END $$;

ALTER TABLE "purchase_invoices"
ADD COLUMN IF NOT EXISTS "status" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "purchase_invoices" pi
SET "status" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "grns" g
    WHERE g."purchaseInvoiceId" = pi."id"
      AND g."status" = 'COMPLETED'
  ) THEN 'RECEIVED'::"PurchaseInvoiceStatus"
  ELSE 'PENDING'::"PurchaseInvoiceStatus"
END;
