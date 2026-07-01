import { z } from 'zod';

const company = z.enum(['GENIUS', 'ACTIVE24', 'BOTH']);

const productFields = {
  code: z.string().trim().min(1).max(50).optional(),
  barcode: z.string().trim().min(1).max(64).optional().nullable().or(z.literal('')),
  name: z.string().trim().min(1, 'Product name is required').max(200),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  brand: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  categoryId: z.string().trim().min(1, 'Category is required'),
  company: company.default('ACTIVE24'),
  purchasePrice: z.coerce.number().nonnegative('Purchase price must be 0 or more').default(0),
  defaultSellingPrice: z.coerce.number().nonnegative('Selling price must be 0 or more').default(0),
  vatPercentage: z.coerce.number().min(0, 'VAT cannot be negative').default(0),
  reorderLevel: z.coerce.number().int().nonnegative().default(10),
  supplierId: z.string().trim().min(1, 'Supplier is required'),
  isActive: z.boolean().optional(),
};

export function buildCreateProductSchema(maxVat = 100) {
  return z
    .object(productFields)
    .refine((d) => d.defaultSellingPrice >= d.purchasePrice, {
      message: 'Selling price must be greater than or equal to purchase price',
      path: ['defaultSellingPrice'],
    })
    .refine((d) => d.vatPercentage <= maxVat, {
      message: `VAT cannot exceed ${maxVat}%`,
      path: ['vatPercentage'],
    });
}

export function buildUpdateProductSchema(maxVat = 100) {
  return z
    .object({
      ...productFields,
      code: productFields.code.optional(),
      name: productFields.name.optional(),
      purchasePrice: productFields.purchasePrice.optional(),
      defaultSellingPrice: productFields.defaultSellingPrice.optional(),
      vatPercentage: productFields.vatPercentage.optional(),
    })
    .partial()
    .refine(
      (d) => d.defaultSellingPrice == null || d.purchasePrice == null || d.defaultSellingPrice >= d.purchasePrice,
      { message: 'Selling price must be greater than or equal to purchase price', path: ['defaultSellingPrice'] }
    )
    .refine((d) => d.vatPercentage == null || d.vatPercentage <= maxVat, {
      message: `VAT cannot exceed ${maxVat}%`,
      path: ['vatPercentage'],
    });
}

export const statusSchema = z.object({
  isActive: z.boolean(),
});

export const duplicateSchema = z.object({
  id: z.string().trim().min(1, 'Product id is required'),
});

export const importSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1, 'At least one row is required'),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  company: company.optional(),
  isActive: z.enum(['true', 'false']).optional(),
  stockAvailability: z.enum(['in_stock', 'low_stock', 'out_of_stock']).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  priceField: z.enum(['purchase', 'selling']).optional(),
  sortBy: z
    .enum(['name', 'code', 'purchasePrice', 'defaultSellingPrice', 'currentStock', 'createdAt'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  format: z.enum(['csv', 'json']).optional(),
});
