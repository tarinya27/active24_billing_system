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
  invoicePrefix: z.string().trim().min(1).max(40).optional(),
  /** Full next/start invoice number, e.g. INV-100 or INV-2026-0100 */
  invoiceNumber: z.string().trim().min(2).max(60).optional(),
  invoiceNextSeq: z.coerce.number().int().min(1).optional(),
  invoiceNumberPad: z.coerce.number().int().min(1).max(12).optional(),
  defaultPaymentMethod: paymentMethodField,
  vatRate: z.coerce.number().min(0).max(100).optional(),
  vatEnabled: z.boolean().optional(),
  currency: z.string().trim().max(10).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  autoPrint: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
});
