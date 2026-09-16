-- AlterTable
ALTER TABLE "settings" ADD COLUMN "estimateActive24Prefix" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN "estimateActive24NextSeq" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "settings" ADD COLUMN "estimateActive24NumberPad" INTEGER NOT NULL DEFAULT 1;
