import { should } from 'chai';
should();
import sessionless from 'sessionless-node';
import fount from 'fount-js';

const baseURL = process.env.SUB_DOMAIN ? `https://${process.env.SUB_DOMAIN}.fount.allyabase.com/` : 'http://127.0.0.1:3006/';
fount.baseURL = baseURL;

let keys = {};
let fountUser = {};
let addieUser = {};

describe('Addie MAGIC Spell Tests', () => {

  before(async () => {
    // Generate keys for testing
    keys = await sessionless.generateKeys(() => { return keys; }, () => { return keys; });

    // Create fount user for spell casting
    fountUser = await fount.createUser(() => keys, () => keys);
    console.log('Created fount user:', fountUser.uuid);
  });

  it('should create user via addieUserCreate spell', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'addieUserCreate',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 0,
      components: {
        pubKey: keys.pubKey
      }
    };

    // Sign the spell
    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    // Cast the spell
    const result = await fount.castSpell('addieUserCreate', spell);

    console.log('addieUserCreate result:', result);

    result.should.have.property('success', true);
    result.should.have.property('user');
    result.user.should.have.property('pubKey', keys.pubKey);

    addieUser = result.user;
  });

  it('should set processor via addieUserProcessor spell', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'addieUserProcessor',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 1,
      components: {
        uuid: addieUser.uuid,
        processor: 'stripe',
        country: 'US',
        name: 'Test User',
        email: 'test@example.com',
        ip: '127.0.0.1'
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('addieUserProcessor', spell);

    console.log('addieUserProcessor result:', result);

    result.should.have.property('success', true);
    result.should.have.property('user');
  });

  it('should create payment intent via addieUserProcessorIntentWithoutSplits spell', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'addieUserProcessorIntentWithoutSplits',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 2,
      components: {
        uuid: addieUser.uuid,
        processor: 'stripe',
        amount: 1999, // $19.99
        currency: 'usd',
        savePaymentMethod: false
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('addieUserProcessorIntentWithoutSplits', spell);

    console.log('addieUserProcessorIntentWithoutSplits result:', result);

    result.should.have.property('success', true);
    result.should.have.property('paymentIntent');
  });

  it('should fail to create user with missing pubKey', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'addieUserCreate',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 3,
      components: {
        // Missing pubKey
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('addieUserCreate', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

  it('should fail to set processor with missing fields', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'addieUserProcessor',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 4,
      components: {
        uuid: addieUser.uuid
        // Missing processor, name, email
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('addieUserProcessor', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

  it('should fail to create payment intent with missing fields', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'addieUserProcessorIntent',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 5,
      components: {
        uuid: addieUser.uuid
        // Missing processor, amount, currency
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('addieUserProcessorIntent', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

  it('should fail to charge saved method with missing fields', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'addieChargeSavedMethod',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 6,
      components: {
        uuid: addieUser.uuid
        // Missing amount, paymentMethodId
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('addieChargeSavedMethod', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

  it('should fail to get payment methods and intent with missing fields', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'addiePaymentMethodsIntent',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 7,
      components: {
        uuid: addieUser.uuid
        // Missing amount, currency
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('addiePaymentMethodsIntent', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

  it('should fail to delete payment method with missing fields', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'addieSavedPaymentMethodDelete',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 8,
      components: {
        uuid: addieUser.uuid
        // Missing paymentMethodId
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('addieSavedPaymentMethodDelete', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

  it('should fail money processor with missing fields', async () => {
    const timestamp = Date.now().toString();

    const spell = {
      spell: 'addieMoneyProcessor',
      casterUUID: fountUser.uuid,
      timestamp,
      totalCost: 50,
      mp: true,
      ordinal: 9,
      components: {
        uuid: addieUser.uuid
        // Missing processor, caster, spellData
      }
    };

    const message = timestamp + spell.spell + spell.casterUUID + spell.totalCost + spell.mp + spell.ordinal;
    spell.casterSignature = await sessionless.sign(message);

    const result = await fount.castSpell('addieMoneyProcessor', spell);

    result.should.have.property('success', false);
    result.should.have.property('error');
  });

});
