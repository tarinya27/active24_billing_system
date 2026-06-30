import { z } from 'zod';

export const adjustStockSchema = z.object({
  productUnitId: z.string().min(1),
  reason: z.string().trim().max(300).optional(),
});
