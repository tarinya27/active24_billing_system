export const PO_COMPANY = 'ACTIVE24';
export const PO_COMPANY_LABEL = 'Active24 (Pvt) Ltd';
export const PO_DELIVERY_ADDRESS = '92, Jambugasmulla Road, Nugegoda';
export const PO_PAYMENT_TERM_OPTIONS = ['7 days', '14 days', '30 days', 'same day', 'other'];

export function resolvePaymentTerms(paymentTerms, paymentTermsOther) {
  if (paymentTerms === 'other') {
    return paymentTermsOther?.trim() || '';
  }
  return paymentTerms;
}

export function splitPaymentTerms(stored) {
  const value = stored || '30 days';
  if (PO_PAYMENT_TERM_OPTIONS.includes(value)) {
    return { paymentTerms: value, paymentTermsOther: '' };
  }
  return { paymentTerms: 'other', paymentTermsOther: value };
}
