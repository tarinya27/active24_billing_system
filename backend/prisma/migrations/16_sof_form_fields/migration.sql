-- AlterTable
ALTER TABLE "service_orders" ADD COLUMN "jobDate" TIMESTAMP(3);
ALTER TABLE "service_orders" ADD COLUMN "shipTo" TEXT;
ALTER TABLE "service_orders" ADD COLUMN "technician" TEXT;
ALTER TABLE "service_orders" ADD COLUMN "createdPerson" TEXT;
ALTER TABLE "service_orders" ADD COLUMN "jobStatus" TEXT;
ALTER TABLE "service_orders" ADD COLUMN "receivedBy" TEXT;
ALTER TABLE "service_orders" ADD COLUMN "customerSignature" TEXT;
ALTER TABLE "service_orders" ADD COLUMN "lines" JSONB NOT NULL DEFAULT '[]';
