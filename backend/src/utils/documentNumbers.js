import { prisma } from '../config/prisma.js';

export async function nextGrnNumber() {
  const year = new Date().getFullYear();
  const prefix = `GRN-${year}-`;
  const latest = await prisma.grn.findFirst({
    where: { grnNumber: { startsWith: prefix } },
    orderBy: { grnNumber: 'desc' },
    select: { grnNumber: true },
  });
  const next = latest ? parseInt(latest.grnNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export async function nextPoNumber(company = 'ACTIVE24') {
  const year = new Date().getFullYear();
  const tag = company === 'GENIUS' ? 'GEN' : 'A24';
  const prefix = `PO-${tag}-${year}-`;
  const latest = await prisma.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: prefix } },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });
  const next = latest ? parseInt(latest.poNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export async function nextInvoiceNumber(prefix = 'INV-2026-') {
  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });
  const next = latest ? parseInt(latest.invoiceNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}
