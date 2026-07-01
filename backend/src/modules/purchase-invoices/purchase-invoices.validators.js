import { z } from 'zod';

const lineSchema = z.object({
  productId: z.string().min(1),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  unitPrice: z.coerce.number().nonnegative(),
  units: z.coerce.number().int().positive(),
});

export const createPurchaseInvoiceSchema = z.object({
  supplierInvoiceNo: z.string().trim().min(1, 'Purchase invoice number is required'),
  poId: z.string().min(1, 'Purchase order is required'),
  supplierId: z.string().min(1),
  company: z.enum(['GENIUS', 'ACTIVE24', 'BOTH']).default('ACTIVE24'),
  vatEnabled: z.boolean().default(false),
  purchaseWithVat: z.boolean().default(false),
  vatRate: z.coerce.number().nonnegative().optional(),
  items: z.array(lineSchema).min(1),
});

export const updatePurchaseInvoiceSchema = createPurchaseInvoiceSchema.partial();

export const calculatePurchaseInvoiceSchema = z.object({
  vatEnabled: z.boolean().default(false),
  purchaseWithVat: z.boolean().default(false),
  vatRate: z.coerce.number().nonnegative().optional(),
  items: z.array(lineSchema).min(1),
});
