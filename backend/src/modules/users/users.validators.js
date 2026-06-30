import { z } from 'zod';

const role = z.enum(['MANAGER', 'ADMIN', 'CASHIER']);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('A valid email is required').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  role: role.default('CASHIER'),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email('A valid email is required').toLowerCase().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100).optional().or(z.literal('')),
    role: role.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });
