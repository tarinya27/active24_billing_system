import { prisma } from '../../config/prisma.js';
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_API } from '../../utils/enums.js';
import {
  formatInvoiceNumber,
  parseInvoiceNumberInput,
  parseSofNumberInput,
  parseEstimateNumberInput,
  renumberAllInvoices,
} from '../../utils/documentNumbers.js';

function serialize(settings, extra = {}) {
  const prefix = settings.invoicePrefix || 'INV-2026-';
  const pad = settings.invoiceNumberPad || 4;
  const seq = settings.invoiceNextSeq || 1;
  const sofPrefix = settings.sofPrefix ?? '';
  const sofPad = Math.max(1, settings.sofNumberPad || 1);
  const sofSeq = settings.sofNextSeq || 1;
  const estimatePrefix = settings.estimatePrefix ?? '';
  const estimatePad = Math.max(1, settings.estimateNumberPad || 1);
  const estimateSeq = settings.estimateNextSeq || 1;
  const estimateActive24Prefix = settings.estimateActive24Prefix ?? '';
  const estimateActive24Pad = Math.max(1, settings.estimateActive24NumberPad || 1);
  const estimateActive24Seq = settings.estimateActive24NextSeq || 1;
  return {
    ...settings,
    vatRate: Number(settings.vatRate),
    defaultPaymentMethod: PAYMENT_METHOD_LABEL[settings.defaultPaymentMethod] || settings.defaultPaymentMethod,
    invoiceNumber: formatInvoiceNumber(prefix, seq, pad),
    sofNumber: formatInvoiceNumber(sofPrefix, sofSeq, sofPad),
    estimateNumber: formatInvoiceNumber(estimatePrefix, estimateSeq, estimatePad),
    estimateActive24Number: formatInvoiceNumber(estimateActive24Prefix, estimateActive24Seq, estimateActive24Pad),
    ...extra,
  };
}

async function syncInvoiceSequenceFromExisting(settings) {
  const prefix = settings.invoicePrefix || 'INV-2026-';
  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: prefix } },
    select: { invoiceNumber: true },
  });

  let maxSeq = 0;
  for (const inv of invoices) {
    const n = parseInt(String(inv.invoiceNumber).slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }

  const expectedNext = maxSeq + 1;
  if ((settings.invoiceNextSeq || 1) >= expectedNext) {
    return settings;
  }

  return prisma.settings.update({
    where: { id: 1 },
    data: { invoiceNextSeq: expectedNext },
  });
}

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: 1 } });
  }
  settings = await syncInvoiceSequenceFromExisting(settings);
  return serialize(settings);
}

export async function updateSettings(data) {
  const payload = { ...data };
  if (payload.companyEmail === '') payload.companyEmail = '';
  if (payload.defaultPaymentMethod && PAYMENT_METHOD_API[payload.defaultPaymentMethod]) {
    payload.defaultPaymentMethod = PAYMENT_METHOD_API[payload.defaultPaymentMethod];
  }

  const invoiceNumberInput = payload.invoiceNumber;
  const sofNumberInput = payload.sofNumber;
  const estimateNumberInput = payload.estimateNumber;
  const estimateActive24NumberInput = payload.estimateActive24Number;
  delete payload.invoiceNumber;
  delete payload.sofNumber;
  delete payload.estimateNumber;
  delete payload.estimateActive24Number;

  if (sofNumberInput != null && String(sofNumberInput).trim() !== '') {
    const parsedSof = parseSofNumberInput(sofNumberInput);
    payload.sofPrefix = parsedSof.prefix;
    payload.sofNumberPad = parsedSof.pad;
    payload.sofNextSeq = parsedSof.sequence;
  }

  if (estimateNumberInput != null && String(estimateNumberInput).trim() !== '') {
    const parsedEstimate = parseEstimateNumberInput(estimateNumberInput);
    payload.estimatePrefix = parsedEstimate.prefix;
    payload.estimateNumberPad = parsedEstimate.pad;
    payload.estimateNextSeq = parsedEstimate.sequence;
  }

  if (estimateActive24NumberInput != null && String(estimateActive24NumberInput).trim() !== '') {
    const parsedActive24 = parseEstimateNumberInput(estimateActive24NumberInput);
    payload.estimateActive24Prefix = parsedActive24.prefix;
    payload.estimateActive24NumberPad = parsedActive24.pad;
    payload.estimateActive24NextSeq = parsedActive24.sequence;
  }

  let current = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!current) {
    current = await prisma.settings.create({ data: { id: 1 } });
  }
  current = await syncInvoiceSequenceFromExisting(current);

  const currentNext = formatInvoiceNumber(
    current.invoicePrefix || 'INV-2026-',
    current.invoiceNextSeq || 1,
    current.invoiceNumberPad || 4
  );

  let renumbered = 0;

  if (invoiceNumberInput != null && String(invoiceNumberInput).trim() !== '') {
    const parsed = parseInvoiceNumberInput(invoiceNumberInput);
    const entered = parsed.formatted;
    const changed = entered !== currentNext
      || parsed.prefix !== (current.invoicePrefix || 'INV-2026-')
      || parsed.pad !== (current.invoiceNumberPad || 4);

    if (changed) {
      const result = await prisma.$transaction(async (tx) => {
        const { renumbered: count, nextSeq } = await renumberAllInvoices(tx, {
          prefix: parsed.prefix,
          startSeq: parsed.sequence,
          pad: parsed.pad,
        });

        const settings = await tx.settings.upsert({
          where: { id: 1 },
          create: {
            id: 1,
            ...payload,
            invoicePrefix: parsed.prefix,
            invoiceNumberPad: parsed.pad,
            invoiceNextSeq: nextSeq,
          },
          update: {
            ...payload,
            invoicePrefix: parsed.prefix,
            invoiceNumberPad: parsed.pad,
            invoiceNextSeq: nextSeq,
          },
        });

        return { settings, renumbered: count };
      });

      return serialize(result.settings, { invoicesRenumbered: result.renumbered });
    }
  }

  // Legacy: allow direct invoicePrefix updates without full invoice number
  if (payload.invoicePrefix && payload.invoicePrefix !== current.invoicePrefix) {
    const prefix = String(payload.invoicePrefix).trim();
    const pad = current.invoiceNumberPad || 4;
    const startSeq = 1;
    const result = await prisma.$transaction(async (tx) => {
      const { renumbered: count, nextSeq } = await renumberAllInvoices(tx, {
        prefix,
        startSeq,
        pad,
      });
      const settings = await tx.settings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          ...payload,
          invoicePrefix: prefix,
          invoiceNumberPad: pad,
          invoiceNextSeq: nextSeq,
        },
        update: {
          ...payload,
          invoicePrefix: prefix,
          invoiceNumberPad: pad,
          invoiceNextSeq: nextSeq,
        },
      });
      return { settings, renumbered: count };
    });
    return serialize(result.settings, { invoicesRenumbered: result.renumbered });
  }

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...payload },
    update: payload,
  });
  return serialize(settings, { invoicesRenumbered: renumbered });
}
