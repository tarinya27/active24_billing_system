import { z } from 'zod';

const type = z.enum(['WALK_IN', 'INDIVIDUAL', 'BUSINESS', 'CORPORATE']);
const salutation = z.enum(['MR', 'MRS', 'MISS', 'DR', 'PROF', 'REV']).optional().nullable();

export const createCustomerSchema = z.object({
  salutation,
  name: z.string().trim().min(1, 'Name is required').max(200),
  mobile: z.string().trim().max(30).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  type: type.default('WALK_IN'),
});

export const updateCustomerSchema = createCustomerSchema.partial();
