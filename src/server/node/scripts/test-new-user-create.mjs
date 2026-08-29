import sessionless from 'sessionless-node';

const ADDIE_URL = process.env.ADDIE_URL || 'http://localhost:3005';

let keys = null;
await sessionless.generateKeys(
  (k) => { keys = k; },
  () => keys
);

const timestamp = Date.now().toString();
const message = timestamp + keys.pubKey;
const signature = await sessionless.sign(message);

const res = await fetch(`${ADDIE_URL}/user/create`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ timestamp, pubKey: keys.pubKey, signature }),
});

console.log('status:', res.status);
console.log('body:', await res.json());
