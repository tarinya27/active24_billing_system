-- CreateEnum
CREATE TYPE "Salutation" AS ENUM ('MR', 'MRS', 'MISS', 'DR', 'PROF', 'REV');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "salutation" "Salutation";
