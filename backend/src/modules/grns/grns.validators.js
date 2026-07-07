import { z } from 'zod';

const grnLineSchema = z.object({
  productId: z.string().min(1),
  categoryId: z.string().min(1).optional().nullable(),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  purchasePrice: z.coerce.number().nonnegative(),
  sellingPriceMode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  sellingPrice: z.coerce.number().nonnegative().optional(),
});

export const reserveGrnBarcodeSchema = z.object({
  purchaseInvoiceId: z.string().min(1),
  barcode: z.string().trim().min(1).max(64),
  productId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional().nullable(),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  purchasePrice: z.coerce.number().nonnegative(),
  sellingPriceMode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  sellingPrice: z.coerce.number().nonnegative().optional(),
  purchaseWithVat: z.boolean().default(false),
  vatRate: z.coerce.number().nonnegative().optional(),
});

export const completeGrnSchema = z.object({
  poId: z.string().min(1, 'Purchase order is required'),
  purchaseInvoiceId: z.string().min(1),
  supplierId: z.string().min(1),
  purchaseWithVat: z.boolean().default(false),
  vatRate: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  lines: z.array(grnLineSchema).min(1),
});

export const cancelGrnSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
