import sessionless from 'sessionless-node';

const ADDIE_URL = 'https://allyabase-gateway.netlify.app/addie';

let keys = null;
await sessionless.generateKeys((k) => { keys = k; }, () => keys);

// Create a real addie user
const createTimestamp = Date.now().toString();
const createRes = await fetch(`${ADDIE_URL}/user/create`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    timestamp: createTimestamp,
    pubKey: keys.pubKey,
    signature: await sessionless.sign(createTimestamp + keys.pubKey),
  }),
});
const user = await createRes.json();
console.log('created addie user ->', createRes.status, user.uuid);
const uuid = user.uuid;

// Create a PaymentIntent - this does NOT charge anything, it only creates a
// pending Stripe object. Nothing gets confirmed/charged without a real card.
const amount = 100; // $1.00, in cents - never actually charged
const currency = 'usd';
const intentTimestamp = Date.now().toString();
const message = intentTimestamp + uuid + amount + currency;
const intentRes = await fetch(`${ADDIE_URL}/user/${uuid}/processor/stripe/intent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    timestamp: intentTimestamp,
    amount,
    currency,
    nonce: 'test-nonce',
    payees: [],
    savePaymentMethod: false,
    signature: await sessionless.sign(message),
  }),
});
const intentBody = await intentRes.json();
console.log('\nintent creation ->', intentRes.status);
console.log(JSON.stringify(intentBody, null, 2));

const isMock = intentBody.paymentIntent === 'foo' || intentBody.customer === 'baz';
const looksReal = typeof intentBody.customer === 'string' && intentBody.customer.startsWith('cus_');

console.log('\n--- verdict ---');
console.log('using mock/stub processor:', isMock);
console.log('using real Stripe API (customer id starts with cus_):', looksReal);
