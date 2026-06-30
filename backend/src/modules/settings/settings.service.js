import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_API } from '../../utils/enums.js';

function serialize(settings) {
  return {
    ...settings,
    vatRate: Number(settings.vatRate),
    defaultPaymentMethod: PAYMENT_METHOD_LABEL[settings.defaultPaymentMethod] || settings.defaultPaymentMethod,
  };
}

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: 1 } });
  }
  return serialize(settings);
}

export async function updateSettings(data) {
  const payload = { ...data };
  if (payload.companyEmail === '') payload.companyEmail = '';
  if (payload.defaultPaymentMethod && PAYMENT_METHOD_API[payload.defaultPaymentMethod]) {
    payload.defaultPaymentMethod = PAYMENT_METHOD_API[payload.defaultPaymentMethod];
  }

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...payload },
    update: payload,
  });
  return serialize(settings);
}
