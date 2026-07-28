import { z } from 'zod';

const dnLineSchema = z.object({
  productId: z.string().min(1),
  categoryId: z.string().min(1).optional().nullable(),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  purchasePrice: z.coerce.number().nonnegative(),
  sellingPriceMode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  sellingPrice: z.coerce.number().nonnegative().optional(),
  units: z.coerce.number().int().positive(),
  warrantyMonths: z.coerce.number().int().positive().optional().nullable(),
});

export const createDeliveryNoteSchema = z.object({
  supplierId: z.string().min(1),
  customerId: z.string().min(1).optional().nullable(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  lines: z.array(dnLineSchema).min(1),
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
