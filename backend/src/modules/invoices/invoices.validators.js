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
  unitPrice: z.coerce.number().positive('Unit price must be greater than 0'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').optional().default(1),
  discount: z.coerce.number().min(0).default(0),
  chargeKind: z.enum(['ITEM', 'SERVICE']).optional(),
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

const zeroValueItemSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  description: z
    .string()
    .max(2000)
    .refine((value) => value.replace(/^\s+|\s+$/g, '').length > 0, 'Description is required'),
});

const updateProductLineSchema = z.object({
  barcode: z.string().trim().min(1).optional(),
  barcodes: z.array(z.string().trim().min(1)).min(1).optional(),
  discount: z.coerce.number().min(0).default(0),
  unitPrice: z.coerce.number().nonnegative().optional(),
  warrantyMonths: z.union([z.null(), z.coerce.number().int().min(0)]).optional(),
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

export const updateInvoiceSchema = z.object({
  customerId: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT']),
  poNo: optionalReferenceField,
  sofNo: optionalReferenceField,
  /** When present, invoice lines are rebuilt from this cart (same shape as create) */
  items: z.array(updateProductLineSchema).optional(),
  services: z.array(serviceLineSchema).optional(),
  /** Optional product lines added during edit at 0.00 */
  zeroValueItems: z.array(zeroValueItemSchema).optional().default([]),
}).superRefine((data, ctx) => {
  if (data.items === undefined && data.services === undefined) return;
  const productCount = data.items?.length || 0;
  const serviceCount = data.services?.length || 0;
  const zeroCount = data.zeroValueItems?.length || 0;
  if (productCount + serviceCount + zeroCount < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Add at least one product or service line',
      path: ['items'],
    });
  }
});

export const settleCreditSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']).default('CASH'),
  amount: z.coerce.number().positive().optional(),
});
