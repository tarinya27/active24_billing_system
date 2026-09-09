-- AlterTable
ALTER TABLE "estimates" ADD COLUMN "jobDate" TIMESTAMP(3);
ALTER TABLE "estimates" ADD COLUMN "sofRef" TEXT;
ALTER TABLE "estimates" ADD COLUMN "lines" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "estimates" ADD COLUMN "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "estimates" ADD COLUMN "vatEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "estimates" ADD COLUMN "preparedBy" TEXT;
ALTER TABLE "estimates" ADD COLUMN "customerSignature" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN "estimatePrefix" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN "estimateNextSeq" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "settings" ADD COLUMN "estimateNumberPad" INTEGER NOT NULL DEFAULT 1;
