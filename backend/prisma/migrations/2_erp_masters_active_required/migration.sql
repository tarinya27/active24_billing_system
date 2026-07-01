-- Category & supplier active flags; required product category + supplier
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

INSERT INTO "categories" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT 'cat_uncategorized_default', 'Uncategorized', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "categories");

INSERT INTO "suppliers" ("id", "name", "company", "isActive", "createdAt", "updatedAt")
SELECT 'sup_default_supplier', 'Default Supplier', 'ACTIVE24', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "suppliers");

UPDATE "products"
SET "categoryId" = (SELECT "id" FROM "categories" ORDER BY "name" LIMIT 1)
WHERE "categoryId" IS NULL;

UPDATE "products"
SET "supplierId" = (SELECT "id" FROM "suppliers" ORDER BY "name" LIMIT 1)
WHERE "supplierId" IS NULL;

ALTER TABLE "products" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "supplierId" SET NOT NULL;
