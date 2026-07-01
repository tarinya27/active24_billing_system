import { env } from '../../config/env.js';
import { fetchMockPurchaseOrders, testMockConnection } from './mockAdapter.js';
import {
  fetchGeniusLankaPurchaseOrders,
  testGeniusLankaConnection,
  PO_SYNC_COMPANY,
} from './geniusLankaAdapter.js';

export { PO_SYNC_COMPANY };

function useMockAdapter() {
  if (env.po.useMock) return true;
  if (!env.po.username || !env.po.password) {
    return !env.isProd;
  }
  return false;
}

export async function fetchExternalPurchaseOrders(company = PO_SYNC_COMPANY) {
  if (useMockAdapter()) {
    return fetchMockPurchaseOrders(company);
  }
  return fetchGeniusLankaPurchaseOrders(company);
}

export async function testExternalPoConnection() {
  if (useMockAdapter()) {
    const result = await testMockConnection();
    if (!env.po.useMock && !env.po.username) {
      return {
        ...result,
        message: `${result.message} (fallback — set PO credentials for live sync)`,
      };
    }
    return result;
  }
  return testGeniusLankaConnection();
}
