import { z } from 'zod';

const company = z.enum(['GENIUS', 'ACTIVE24', 'BOTH']);
const optionalText = z.string().trim().max(200).optional().or(z.literal(''));

export const createSupplierSchema = z.object({
  code: z.string().trim().max(50).optional().or(z.literal('')),
  name: z.string().trim().min(1, 'Name is required').max(200),
  contactPerson: optionalText,
  phone: optionalText,
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  city: optionalText,
  company: company.default('ACTIVE24'),
});

export const updateSupplierSchema = createSupplierSchema.partial();
