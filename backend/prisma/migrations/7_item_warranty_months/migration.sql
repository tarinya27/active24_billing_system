-- Add optional warranty period (months) across procurement and sales chain
ALTER TABLE "po_items" ADD COLUMN "warrantyMonths" INTEGER;
ALTER TABLE "purchase_invoice_items" ADD COLUMN "warrantyMonths" INTEGER;
ALTER TABLE "grn_items" ADD COLUMN "warrantyMonths" INTEGER;
ALTER TABLE "product_units" ADD COLUMN "warrantyMonths" INTEGER;
ALTER TABLE "invoice_items" ADD COLUMN "warrantyMonths" INTEGER;
