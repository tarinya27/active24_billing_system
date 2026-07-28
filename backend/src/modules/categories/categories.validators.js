import { z } from 'zod';

const codePrefixField = z
  .string()
  .trim()
  .max(20, 'Prefix must be at most 20 characters')
  .optional()
  .nullable()
  .or(z.literal(''));

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  codePrefix: codePrefixField,
  inventoryCodePrefix: codePrefixField,
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryStatusSchema = z.object({
  isActive: z.boolean(),
});
