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
  sofNumber: z.string().trim().min(1).max(60).optional(),
  sofPrefix: z.string().max(40).optional(),
  sofNextSeq: z.coerce.number().int().min(1).optional(),
  sofNumberPad: z.coerce.number().int().min(1).max(12).optional(),
  estimateNumber: z.string().trim().min(1).max(60).optional(),
  estimatePrefix: z.string().max(40).optional(),
  estimateNextSeq: z.coerce.number().int().min(1).optional(),
  estimateNumberPad: z.coerce.number().int().min(1).max(12).optional(),
  estimateActive24Number: z.string().trim().min(1).max(60).optional(),
  estimateActive24Prefix: z.string().max(40).optional(),
  estimateActive24NextSeq: z.coerce.number().int().min(1).optional(),
  estimateActive24NumberPad: z.coerce.number().int().min(1).max(12).optional(),
  invoiceNextSeq: z.coerce.number().int().min(1).optional(),
  invoiceNumberPad: z.coerce.number().int().min(1).max(12).optional(),
  defaultPaymentMethod: paymentMethodField,
  vatRate: z.coerce.number().min(0).max(100).optional(),
  vatEnabled: z.boolean().optional(),
  currency: z.string().trim().max(10).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  autoPrint: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  invoiceDeletePassword: z.union([
    z.string().trim().min(4, 'Invoice delete password must be at least 4 characters').max(100),
    z.literal(''),
  ]).optional(),
});
