#!/usr/bin/env node

import sessionless from 'sessionless-node';

const ADDIE_URL = process.env.ADDIE_URL || 'http://localhost:3005';

let keys;
const getKeys = () => keys;
const saveKeys = (k) => keys = k; 

async function createStripeAccount(name, email, country = 'US') {
  console.log('\n🔐 Generating keypair...');
  const { pubKey, privateKey } = await sessionless.generateKeys(saveKeys, getKeys);
  console.log('Public Key:', pubKey);
  console.log('Private Key:', 'it\'s a secret to everyone' + '...');

  // Step 1: Create user
  console.log('\n👤 Creating Addie user...');
  const timestamp1 = Date.now().toString();
  const message1 = timestamp1 + pubKey;
  const signature1 = await sessionless.sign(message1);

  const createUserResponse = await fetch(`${ADDIE_URL}/user/create`, {
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

  // Step 2: Create Stripe account
  console.log('\n💳 Creating Stripe account...');
  const timestamp2 = Date.now().toString();
  const message2 = timestamp2 + userData.uuid + name + email;
  const signature2 = await sessionless.sign(message2);

  const stripeResponse = await fetch(`${ADDIE_URL}/user/${userData.uuid}/processor/stripe`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: timestamp2,
      country,
      name,
      email,
      signature: signature2
    })
  });

  const stripeData = await stripeResponse.json();

  if (stripeData.error) {
    console.error('❌ Error creating Stripe account:', stripeData.error);
    process.exit(1);
  }

  console.log('\n✅ Stripe account created successfully!');
  console.log('\n📋 Account Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Addie UUID:', userData.uuid);
  console.log('Public Key:', pubKey);
  console.log('Stripe Account ID:', stripeData.stripeAccountId);
  console.log('Country:', country);
  console.log('Name:', name);
  console.log('Email:', email);
  console.log('\n🔑 Private Key (SAVE THIS!):', privateKey);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
Usage: node create-stripe-account.js <name> <email> [country]

Arguments:
  name      Full name (e.g., "John Doe")
  email     Email address
  country   Country code (default: US)

Examples:
  node create-stripe-account.js "John Doe" "john@example.com"
  node create-stripe-account.js "Jane Smith" "jane@example.com" CA

Environment Variables:
  ADDIE_URL   Addie service URL (default: http://localhost:3005)
`);
  process.exit(1);
}

const [name, email, country] = args;

createStripeAccount(name, email, country || 'US')
  .catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
