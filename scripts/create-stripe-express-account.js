#!/usr/bin/env node

import sessionless from 'sessionless-node';

const ADDIE_URL = process.env.ADDIE_URL || 'http://localhost:3005';

let keys;
const getKeys = () => keys;
const saveKeys = (k) => keys = k;

async function createStripeExpressAccount(email, country = 'US') {
  console.log('\n🔐 Generating keypair...');
  const { pubKey, privateKey } = await sessionless.generateKeys(saveKeys, getKeys);
  console.log('Public Key:', pubKey);
  console.log('Private Key:', 'it\'s a secret to everyone' + '...');

  // Step 1: Create user
  console.log('\n👤 Creating Addie user...');
  const timestamp1 = Date.now().toString();
  const message1 = timestamp1 + pubKey;
  const signature1 = await sessionless.sign(message1);

  const url = `${ADDIE_URL}/user/create`;
  console.log('Creating user at', url);
console.log(fetch);

  const createUserResponse = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubKey,
      timestamp: timestamp1,
      signature: signature1
    })
  });

  const userData = await createUserResponse.json();

  if (userData.error) {
    console.error('❌ Error creating user:', userData.error);
    process.exit(1);
  }

  console.log('✅ User created:', userData.uuid);

  // Step 2: Create Stripe Express account
  console.log('\n💳 Creating Stripe Express account...');
  const timestamp2 = Date.now().toString();
  const message2 = timestamp2 + userData.uuid + email;
  const signature2 = await sessionless.sign(message2);

  const refreshUrl = `${ADDIE_URL}/stripe/refresh`;
  const returnUrl = `${ADDIE_URL}/stripe/complete`;

  const stripeResponse = await fetch(`${ADDIE_URL}/user/${userData.uuid}/processor/stripe/express`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: timestamp2,
      country,
      email,
      refreshUrl,
      returnUrl,
      signature: signature2
    })
  });

  const stripeData = await stripeResponse.json();

  if (stripeData.error) {
    console.error('❌ Error creating Stripe Express account:', stripeData.error);
    process.exit(1);
  }

  console.log('\n✅ Stripe Express account created successfully!');

  // Step 3: Generate Payee Quad
  console.log('\n💎 Generating Payee Quad...');
  const percent = 0; // Use 0 for flexible amounts per transaction
  const payeeMessage = pubKey + ADDIE_URL + percent;
  const payeeSignature = await sessionless.sign(payeeMessage);

  const payeeQuad = {
    pubKey,
    addieURL: ADDIE_URL,
    percent,
    signature: payeeSignature
  };

  console.log('\n📋 Account Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Addie UUID:', userData.uuid);
  console.log('Public Key:', pubKey);
  console.log('Stripe Account ID:', stripeData.stripeAccountId);
  console.log('Country:', country);
  console.log('Email:', email);
  console.log('\n🔗 Onboarding URL:');
  console.log(stripeData.stripeOnboardingUrl);
  console.log('\n💎 Payee Quad (for payment splits):');
  console.log(JSON.stringify(payeeQuad, null, 2));
  console.log('\n🔑 Private Key (SAVE THIS!):', privateKey);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📝 Next Steps:');
  console.log('1. Visit the onboarding URL above');
  console.log('2. Complete Stripe\'s verification process');
  console.log('3. Add bank account for receiving payouts');
  console.log('4. Account will be ready to receive transfers');
  console.log('5. Use the Payee Quad above in payment split arrays\n');
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(`
Usage: node create-stripe-express-account.js <email> [country]

Arguments:
  email     Email address
  country   Country code (default: US)

Examples:
  node create-stripe-express-account.js "john@example.com"
  node create-stripe-express-account.js "jane@example.com" CA

Environment Variables:
  ADDIE_URL   Addie service URL (default: http://localhost:3005)
`);
  process.exit(1);
}

const [email, country] = args;

createStripeExpressAccount(email, country || 'US')
  .catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
