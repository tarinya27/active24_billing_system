-- Inventory category code prefix for automatic inventory code generation
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "codePrefix" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "codeSequence" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "categories_codePrefix_key" ON "categories"("codePrefix");
