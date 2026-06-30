import { z } from 'zod';

const type = z.enum(['WALK_IN', 'INDIVIDUAL', 'BUSINESS', 'CORPORATE']);

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  mobile: z.string().trim().max(30).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  type: type.default('WALK_IN'),
});

export const updateCustomerSchema = createCustomerSchema.partial();
