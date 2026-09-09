-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TECHNICAL';

-- CreateEnum
CREATE TYPE "TechnicalJobStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_orders" (
    "id" TEXT NOT NULL,
    "sofNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "status" "TechnicalJobStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" "TechnicalJobStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_orders_sofNumber_key" ON "service_orders"("sofNumber");
CREATE INDEX "service_orders_customerId_idx" ON "service_orders"("customerId");
CREATE INDEX "service_orders_createdById_idx" ON "service_orders"("createdById");

CREATE UNIQUE INDEX "estimates_estimateNumber_key" ON "estimates"("estimateNumber");
CREATE INDEX "estimates_customerId_idx" ON "estimates"("customerId");
CREATE INDEX "estimates_createdById_idx" ON "estimates"("createdById");

ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "estimates" ADD CONSTRAINT "estimates_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
