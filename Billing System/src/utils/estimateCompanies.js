export const ESTIMATE_COMPANY = {
  GENIUS: 'GENIUS',
  ACTIVE24: 'ACTIVE24',
};

export const ESTIMATE_COMPANIES = {
  GENIUS: {
    key: ESTIMATE_COMPANY.GENIUS,
    label: 'Genius',
    name: 'Genius Associates (Pvt) Ltd',
    lines: [
      'No. 1,',
      'Skelton Gardens,',
      'Colombo 05.',
      'Tel: 0115522266/7 , 0115656578',
      'E-mail: technical1@geniuslanka.com',
    ],
    signoffName: 'Genius Associates (Pvt) Ltd',
    phones: ['0777 300210', '0115656578/ 0115522266'],
    vatEnabled: true,
    vatRate: 18,
    vatNote: 'VAT 18% will be added',
  },
  ACTIVE24: {
    key: ESTIMATE_COMPANY.ACTIVE24,
    label: 'Active24',
    name: 'Active24 (Pvt) Ltd',
    lines: [
      'No 92, Jambugasmulla Road, Nugegoda',
      'Tel: (011) 255 2245',
      'Email: active24.pvt.ltd@gmail.com',
    ],
    signoffName: 'Active24 (Pvt) Ltd',
    phones: ['(011) 255 2245'],
    vatEnabled: false,
    vatRate: 0,
    vatNote: 'VAT will not be added',
  },
};

export function resolveEstimateCompany(value) {
  return value === ESTIMATE_COMPANY.ACTIVE24
    ? ESTIMATE_COMPANY.ACTIVE24
    : ESTIMATE_COMPANY.GENIUS;
}

export function getEstimateCompanyProfile(value) {
  if (value !== ESTIMATE_COMPANY.GENIUS && value !== ESTIMATE_COMPANY.ACTIVE24) {
    return null;
  }
  return ESTIMATE_COMPANIES[value];
}
