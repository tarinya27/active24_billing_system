import { prisma } from '../config/prisma.js';
import { ApiError } from './ApiError.js';

export function formatInvoiceNumber(prefix, sequence, pad = 4) {
  const safePad = Math.max(1, Number(pad) || 4);
  const seq = Number(sequence);
  return `${prefix}${String(seq).padStart(safePad, '0')}`;
}

/**
 * Parse a full invoice number like INV-100 or INV-2026-0100 into prefix + sequence + pad.
 */
export function parseInvoiceNumberInput(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw ApiError.badRequest('Invoice number is required');
  }

  const match = raw.match(/^(.*?)(\d+)$/);
  if (!match || !match[1]) {
    throw ApiError.badRequest('Invoice number must include a prefix and end with digits (e.g. INV-100 or INV-2026-0100)');
  }

  const prefix = match[1];
  const digits = match[2];
  const sequence = parseInt(digits, 10);
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw ApiError.badRequest('Invoice number sequence must be a positive integer');
  }

  return {
    prefix,
    sequence,
    pad: digits.length,
    formatted: formatInvoiceNumber(prefix, sequence, digits.length),
  };
}

export async function nextDnNumber() {
  const year = new Date().getFullYear();
  const prefix = `DN-${year}-`;
  const latest = await prisma.deliveryNote.findFirst({
    where: { dnNumber: { startsWith: prefix } },
    orderBy: { dnNumber: 'desc' },
    select: { dnNumber: true },
  });
  const next = latest ? parseInt(latest.dnNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

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

/** @deprecated Prefer allocateInvoiceNumber(tx) so sequence persists correctly */
export async function nextInvoiceNumber(prefix = 'INV-2026-') {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const usePrefix = settings?.invoicePrefix || prefix;
  const pad = settings?.invoiceNumberPad || 4;
  const seq = settings?.invoiceNextSeq || 1;
  return formatInvoiceNumber(usePrefix, seq, pad);
}

/**
 * Allocate the next invoice number inside a transaction and increment the stored sequence.
 */
export async function allocateInvoiceNumber(tx) {
  const db = tx || prisma;
  let settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await db.settings.create({ data: { id: 1 } });
  }

  const prefix = settings.invoicePrefix || 'INV-2026-';
  const pad = settings.invoiceNumberPad || 4;
  const seq = settings.invoiceNextSeq || 1;
  const invoiceNumber = formatInvoiceNumber(prefix, seq, pad);

  await db.settings.update({
    where: { id: 1 },
    data: { invoiceNextSeq: seq + 1 },
  });

  return invoiceNumber;
}

/**
 * Renumber all invoices chronologically starting at startSeq.
 * Returns the next sequence after the last renumbered invoice.
 */
export async function renumberAllInvoices(tx, { prefix, startSeq, pad }) {
  const invoices = await tx.invoice.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, invoiceNumber: true },
  });

  for (const inv of invoices) {
    await tx.invoice.update({
      where: { id: inv.id },
      data: { invoiceNumber: `__renum_${inv.id}` },
    });
  }

  let seq = startSeq;
  for (const inv of invoices) {
    const newNumber = formatInvoiceNumber(prefix, seq, pad);
    await tx.invoice.update({
      where: { id: inv.id },
      data: { invoiceNumber: newNumber },
    });

    await tx.stockMovement.updateMany({
      where: { reference: inv.invoiceNumber },
      data: { reference: newNumber },
    });
    await tx.stockMovement.updateMany({
      where: { reference: `Cancel ${inv.invoiceNumber}` },
      data: { reference: `Cancel ${newNumber}` },
    });
    await tx.stockMovement.updateMany({
      where: { reference: `Edit ${inv.invoiceNumber}` },
      data: { reference: `Edit ${newNumber}` },
    });

    await tx.activity.updateMany({
      where: { title: `Invoice ${inv.invoiceNumber}` },
      data: { title: `Invoice ${newNumber}` },
    });
    await tx.activity.updateMany({
      where: { title: `Invoice ${inv.invoiceNumber} updated` },
      data: { title: `Invoice ${newNumber} updated` },
    });

    seq += 1;
  }

  return {
    renumbered: invoices.length,
    nextSeq: seq,
  };
}
