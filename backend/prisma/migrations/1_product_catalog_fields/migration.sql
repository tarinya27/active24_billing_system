-- Product catalog fields: barcode, brand, purchase price, VAT %
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchasePrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vatPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "products_barcode_key" ON "products"("barcode");
