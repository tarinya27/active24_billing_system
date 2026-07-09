import { z } from 'zod';

const poStatus = z.enum(['PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED']);
const fulfillmentType = z.enum(['DELIVERY', 'COLLECTION']);

const poLineSchema = z
  .object({
    productId: z.string().min(1).optional(),
    description: z.string().trim().max(500).optional(),
    quantity: z.coerce.number().int().positive(),
    costPrice: z.coerce.number().nonnegative(),
    warrantyMonths: z.coerce.number().int().positive().optional().nullable(),
  })
  .refine((line) => Boolean(line.productId || line.description?.trim()), {
    message: 'Each line needs a description or product',
  });

export const syncPoSchema = z.object({
  company: z.enum(['GENIUS', 'ACTIVE24', 'BOTH']).default('ACTIVE24'),
});

export const importBackupSchema = z.object({
  company: z.enum(['GENIUS', 'ACTIVE24', 'BOTH']).default('ACTIVE24'),
  backup: z.unknown(),
});

export const createPoSchema = z.object({
  poNumber: z.string().trim().min(1).max(50).optional(),
  company: z.enum(['GENIUS', 'ACTIVE24']).default('ACTIVE24'),
  supplierId: z.string().min(1),
  orderDate: z.coerce.date().optional(),
  expectedDelivery: z.coerce.date().optional().nullable(),
  status: poStatus.default('PENDING'),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  supplierRefNo: z.string().trim().max(100).optional().or(z.literal('')),
  attn: z.string().trim().max(100).optional().or(z.literal('')),
  paymentTerms: z.string().trim().max(50).optional(),
  fulfillmentType: fulfillmentType.default('DELIVERY'),
  deliveryAddress: z.string().trim().max(500).optional().or(z.literal('')),
  collectedBy: z.string().trim().max(100).optional().or(z.literal('')),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  items: z.array(poLineSchema).min(1),
});

export const updatePoSchema = createPoSchema.partial().extend({
  items: z.array(poLineSchema).optional(),
});
