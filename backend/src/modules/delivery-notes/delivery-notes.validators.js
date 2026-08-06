import { z } from 'zod';

const dnLineSchema = z.object({
  /** Prefer category + description; productId kept for backward compatibility */
  productId: z.string().min(1).optional(),
  categoryId: z.string().min(1),
  description: z.string().trim().min(1, 'Description is required').max(500),
  purchasePrice: z.coerce.number().nonnegative(),
  sellingPriceMode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  sellingPrice: z.coerce.number().nonnegative().optional(),
  /** Optional when barcodes are provided — qty is derived from scanned barcodes */
  units: z.coerce.number().int().positive().optional(),
  barcodes: z.array(z.string().trim().min(1).max(64)).min(1, 'Scan at least one barcode per item'),
  warrantyMonths: z.coerce.number().int().positive().optional().nullable(),
}).superRefine((line, ctx) => {
  const unique = new Set(line.barcodes.map((b) => b.trim()));
  if (unique.size !== line.barcodes.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate barcodes on the same line', path: ['barcodes'] });
  }
  if (line.units != null && line.units !== line.barcodes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Units (${line.units}) must match scanned barcodes (${line.barcodes.length})`,
      path: ['units'],
    });
  }
});

export const createDeliveryNoteSchema = z.object({
  supplierId: z.string().min(1),
  customerId: z.string().min(1).optional().nullable(),
  invNo: z.string().trim().max(100).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  lines: z.array(dnLineSchema).min(1),
}).superRefine((data, ctx) => {
  const all = data.lines.flatMap((l) => l.barcodes.map((b) => b.trim()));
  if (new Set(all).size !== all.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate barcodes across delivery note lines', path: ['lines'] });
  }
});

export const reserveDnBarcodeSchema = z.object({
  deliveryNoteId: z.string().min(1),
  productId: z.string().min(1),
  barcode: z.string().trim().min(1).max(64),
});

export const completeDeliveryNoteSchema = z.object({
  deliveryNoteId: z.string().min(1),
});

export const cancelDeliveryNoteSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

const updateDnLineSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  sellingPriceMode: z.enum(['AUTO', 'MANUAL']).optional(),
  sellingPrice: z.coerce.number().nonnegative().optional(),
});

export const updateDeliveryNoteSchema = z.object({
  notes: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  items: z.array(updateDnLineSchema).optional(),
});

export const createInvoiceFromDnSchema = z.object({
  customerId: z.string().min(1).optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT']).default('CASH'),
  discounts: z
    .array(z.object({
      barcode: z.string().trim().min(1),
      discount: z.coerce.number().nonnegative().default(0),
    }))
    .optional(),
});
