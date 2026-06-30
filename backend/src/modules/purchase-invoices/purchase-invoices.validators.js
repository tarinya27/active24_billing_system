import { z } from 'zod';

const lineSchema = z.object({
  productId: z.string().min(1),
  unitPrice: z.coerce.number().nonnegative(),
  units: z.coerce.number().int().positive(),
});

export const createPurchaseInvoiceSchema = z.object({
  supplierInvoiceNo: z.string().trim().max(100).optional().or(z.literal('')),
  poId: z.string().min(1).optional().nullable(),
  supplierId: z.string().min(1),
  company: z.enum(['GENIUS', 'ACTIVE24', 'BOTH']).default('ACTIVE24'),
  purchaseWithVat: z.boolean().default(false),
  vatRate: z.coerce.number().nonnegative().optional(),
  items: z.array(lineSchema).min(1),
});

export const updatePurchaseInvoiceSchema = createPurchaseInvoiceSchema.partial();
