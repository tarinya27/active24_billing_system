import { z } from 'zod';

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT']),
  items: z
    .array(
      z.object({
        barcode: z.string().trim().min(1),
        discount: z.coerce.number().min(0).default(0),
      })
    )
    .min(1, 'At least one item is required'),
});

export const settleCreditSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']).default('CASH'),
  amount: z.coerce.number().positive().optional(),
});
