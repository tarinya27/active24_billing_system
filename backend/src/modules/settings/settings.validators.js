import { z } from 'zod';
import { PAYMENT_METHOD_API } from '../../utils/enums.js';

const paymentMethodField = z.preprocess(
  (val) => {
    if (typeof val === 'string' && PAYMENT_METHOD_API[val]) return PAYMENT_METHOD_API[val];
    return val;
  },
  z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT']).optional()
);

export const updateSettingsSchema = z.object({
  companyName: z.string().trim().min(1).max(200).optional(),
  companyAddress: z.string().max(500).optional(),
  companyPhone: z.string().max(50).optional(),
  companyEmail: z.union([z.string().email().max(200), z.literal('')]).optional(),
  invoicePrefix: z.string().trim().min(1).max(30).optional(),
  defaultPaymentMethod: paymentMethodField,
  vatRate: z.coerce.number().min(0).max(100).optional(),
  vatEnabled: z.boolean().optional(),
  currency: z.string().trim().max(10).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  autoPrint: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
});
