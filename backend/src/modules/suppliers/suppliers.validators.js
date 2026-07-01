import { z } from 'zod';

const optionalText = z.string().trim().max(200).optional().or(z.literal(''));

export const createSupplierSchema = z.object({
  code: z.string().trim().max(50).optional().or(z.literal('')),
  name: z.string().trim().min(1, 'Company name is required').max(200),
  contactPerson: optionalText,
  phone: optionalText,
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  city: optionalText,
  company: z.enum(['GENIUS', 'ACTIVE24', 'BOTH']).default('ACTIVE24'),
  vatRate: z.coerce.number().min(0).max(100).default(0),
  vatRegistrationNo: z.string().trim().max(100).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const supplierStatusSchema = z.object({
  isActive: z.boolean(),
});
