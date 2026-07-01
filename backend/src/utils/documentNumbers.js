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
  return nextPoSerialNumber(company);
}

export async function nextPoSerialNumber(company = 'ACTIVE24') {
  const orders = await prisma.purchaseOrder.findMany({
    where: { company },
    select: { poNumber: true },
  });

  let maxSerial = 10000;
  for (const { poNumber } of orders) {
    const numeric = parseInt(poNumber, 10);
    if (!Number.isNaN(numeric) && numeric > maxSerial) {
      maxSerial = numeric;
    }
  }

  return String(maxSerial + 1);
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
