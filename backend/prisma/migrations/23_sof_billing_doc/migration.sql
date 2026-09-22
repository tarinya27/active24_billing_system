-- AlterTable
CREATE TYPE "SofBillingDocType" AS ENUM ('NONE', 'INVOICE', 'DN');
ALTER TABLE "service_orders" ADD COLUMN "billingDocType" "SofBillingDocType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "service_orders" ADD COLUMN "billingDocNumber" TEXT;
