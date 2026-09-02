import { z } from 'zod';

const productLineSchema = z.object({
  barcode: z.string().trim().min(1).optional(),
  barcodes: z.array(z.string().trim().min(1)).min(1).optional(),
  discount: z.coerce.number().min(0).default(0),
}).superRefine((data, ctx) => {
  const hasBarcode = Boolean(data.barcode);
  const hasBarcodes = Array.isArray(data.barcodes) && data.barcodes.length > 0;
  if (!hasBarcode && !hasBarcodes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Product line requires a barcode',
      path: ['barcode'],
    });
  }
});

const serviceLineSchema = z.object({
  description: z
    .string()
    .min(1, 'Service description is required')
    .max(2000)
    .refine((value) => value.replace(/^\s+|\s+$/g, '').length > 0, 'Service description is required'),
  unitPrice: z.coerce.number().positive('Service amount must be greater than 0'),
  discount: z.coerce.number().min(0).default(0),
});

const optionalReferenceField = z
  .string()
  .max(100)
  .optional()
  .nullable()
  .transform((value) => {
    const text = value != null ? String(value).trim() : '';
    return text || undefined;
  });

const invoiceLinesSchema = z.object({
  customerId: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT']),
  deliveryNoteId: z.string().min(1).optional().nullable(),
  poNo: optionalReferenceField,
  sofNo: optionalReferenceField,
  /** Existing barcode product lines — unchanged behaviour */
  items: z.array(productLineSchema).default([]),
  /** Optional service / additional charge lines (no barcode, no stock) */
  services: z.array(serviceLineSchema).default([]),
}).superRefine((data, ctx) => {
  if ((data.items?.length || 0) + (data.services?.length || 0) < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Add at least one product or service line',
      path: ['items'],
    });
  }
});

export const createInvoiceSchema = invoiceLinesSchema;
export const updateInvoiceSchema = z.object({
  customerId: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT']),
});

export const settleCreditSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']).default('CASH'),
  amount: z.coerce.number().positive().optional(),
});
