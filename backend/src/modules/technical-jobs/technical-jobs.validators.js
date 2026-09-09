import { z } from 'zod';

const optionalText = z
  .string()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => {
    const text = value != null ? String(value).trim() : '';
    return text || null;
  });

const status = z.enum(['OPEN', 'COMPLETED', 'CANCELLED']).optional();

export const createSofSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  description: optionalText,
  notes: optionalText,
  status,
});

export const updateSofSchema = createSofSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'No fields to update' }
);

export const createEstimateSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  description: optionalText,
  notes: optionalText,
  amount: z.coerce.number().min(0, 'Amount cannot be negative').default(0),
  status,
});

export const updateEstimateSchema = createEstimateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'No fields to update' }
);
