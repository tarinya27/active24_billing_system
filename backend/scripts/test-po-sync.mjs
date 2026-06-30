const base = 'http://localhost:4000/api';
const login = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'manager@active24.lk', password: 'Manager@123' }),
}).then((r) => r.json());

const h = {
  Authorization: `Bearer ${login.data.accessToken}`,
  'Content-Type': 'application/json',
};

const test = await fetch(`${base}/purchase-orders/sync/test`, { headers: h }).then((r) => r.json());
console.log('test', test.data);

const sync = await fetch(`${base}/purchase-orders/sync`, {
  method: 'POST',
  headers: h,
  body: JSON.stringify({ company: 'ACTIVE24' }),
}).then((r) => r.json());

console.log('sync summary', {
  created: sync.data?.created,
  skipped: sync.data?.skipped,
  error: sync.error?.message,
});
console.log('detail', sync.data?.details?.[0]);
