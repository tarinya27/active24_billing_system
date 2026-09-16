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

const sofLineSchema = z.object({
  categoryId: optionalText,
  item: optionalText,
  description: optionalText,
  qty: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.coerce.number().min(0).nullable().optional()
  ),
  fault: optionalText,
});

export const createSofSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  jobDate: z.string().trim().optional().nullable(),
  shipTo: optionalText,
  technician: optionalText,
  createdPerson: optionalText,
  jobStatus: optionalText,
  receivedBy: optionalText,
  customerSignature: optionalText,
  lines: z.array(sofLineSchema).optional().default([]),
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
  jobDate: z.string().trim().optional().nullable(),
  sofRef: optionalText,
  machineModel: optionalText,
  serialNo: optionalText,
  company: z.enum(['GENIUS', 'ACTIVE24']).optional(),
  lines: z.array(z.object({
    description: optionalText,
    qty: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.coerce.number().min(0).nullable().optional()
    ),
    rate: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.coerce.number().min(0).nullable().optional()
    ),
    amount: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.coerce.number().min(0).nullable().optional()
    ),
  })).optional().default([]),
  description: optionalText,
  notes: optionalText,
  amount: z.coerce.number().min(0, 'Amount cannot be negative').optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  vatEnabled: z.boolean().optional(),
  preparedBy: optionalText,
  customerSignature: optionalText,
  status,
});

export const updateEstimateSchema = createEstimateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'No fields to update' }
);
