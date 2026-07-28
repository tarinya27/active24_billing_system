-- Delivery Notes: parallel stock-in and sales invoice path (additive only)

-- Enums
ALTER TYPE "UnitStatus" ADD VALUE IF NOT EXISTS 'PENDING_DN';
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'DN_IN';

DO $$ BEGIN
  CREATE TYPE "DnStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED', 'INVOICED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Delivery notes
CREATE TABLE IF NOT EXISTS "delivery_notes" (
    "id" TEXT NOT NULL,
    "dnNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "customerId" TEXT,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DnStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_notes_dnNumber_key" ON "delivery_notes"("dnNumber");
CREATE INDEX IF NOT EXISTS "delivery_notes_supplierId_idx" ON "delivery_notes"("supplierId");
CREATE INDEX IF NOT EXISTS "delivery_notes_customerId_idx" ON "delivery_notes"("customerId");

-- Delivery note items
CREATE TABLE IF NOT EXISTS "delivery_note_items" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "categoryId" TEXT,
    "description" TEXT,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "costExVat" DECIMAL(12,2) NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "sellingPriceMode" "SellingPriceMode" NOT NULL DEFAULT 'AUTO',
    "units" INTEGER NOT NULL,
    "warrantyMonths" INTEGER,

    CONSTRAINT "delivery_note_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "delivery_note_items_deliveryNoteId_idx" ON "delivery_note_items"("deliveryNoteId");

-- Product unit DN links
ALTER TABLE "product_units" ADD COLUMN IF NOT EXISTS "deliveryNoteId" TEXT;
ALTER TABLE "product_units" ADD COLUMN IF NOT EXISTS "deliveryNoteItemId" TEXT;
CREATE INDEX IF NOT EXISTS "product_units_deliveryNoteId_idx" ON "product_units"("deliveryNoteId");

-- Invoice DN link
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deliveryNoteId" TEXT;
CREATE INDEX IF NOT EXISTS "invoices_deliveryNoteId_idx" ON "invoices"("deliveryNoteId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_receivedById_fkey"
    FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_deliveryNoteId_fkey"
    FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "product_units" ADD CONSTRAINT "product_units_deliveryNoteId_fkey"
    FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "product_units" ADD CONSTRAINT "product_units_deliveryNoteItemId_fkey"
    FOREIGN KEY ("deliveryNoteItemId") REFERENCES "delivery_note_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deliveryNoteId_fkey"
    FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
