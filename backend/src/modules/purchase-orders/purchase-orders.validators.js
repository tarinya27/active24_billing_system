import { z } from 'zod';

const poStatus = z.enum(['PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED']);

export const createPoSchema = z.object({
  poNumber: z.string().trim().min(1).max(50).optional(),
  company: z.enum(['GENIUS', 'ACTIVE24']).default('ACTIVE24'),
  supplierId: z.string().min(1),
  orderDate: z.coerce.date().optional(),
  expectedDelivery: z.coerce.date().optional().nullable(),
  status: poStatus.default('PENDING'),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        costPrice: z.coerce.number().nonnegative(),
      })
    )
    .min(1),
});

export const updatePoSchema = createPoSchema.partial().extend({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        costPrice: z.coerce.number().nonnegative(),
      })
    )
    .optional(),
});
