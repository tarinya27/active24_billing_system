import { z } from 'zod';

const company = z.enum(['GENIUS', 'ACTIVE24', 'BOTH']);

export const createProductSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(50),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  categoryId: z.string().trim().min(1).optional().nullable(),
  company: company.default('ACTIVE24'),
  defaultSellingPrice: z.coerce.number().nonnegative('Selling price must be 0 or more'),
  reorderLevel: z.coerce.number().int().nonnegative().default(10),
  supplierId: z.string().trim().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();
