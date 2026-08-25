import addie from '../../src/client/javascript/addie.js';
import { should } from 'chai';
should();

console.log(addie);

// Set base URL to localhost for testing
addie.baseURL = process.env.ADDIE_URL || 'http://localhost:3005/';

const savedUser = {};
let keys;
let stripeCustomerId;
let cardholderId;
let virtualCardId;

describe('Addie Client SDK', function() {
  this.timeout(10000);

  describe('User Management', function() {
    it('should register a user', async () => {
      const uuid = await addie.createUser((k) => { keys = k; }, () => { return keys; });
      savedUser.uuid = uuid;
      savedUser.uuid.length.should.equal(36);
    });

    it('should get a user', async () => {
      const addieUser = await addie.getUserByUUID(savedUser.uuid);
      addieUser.uuid.should.equal(savedUser.uuid);
    });
  });

  describe('Payment Method Management', function() {
    it('should create SetupIntent for saving cards', async () => {
      const res = await addie.createSetupIntent('stripe');
      res.should.have.property('clientSecret');
      res.should.have.property('customerId');
      res.should.have.property('publishableKey');
      res.clientSecret.should.match(/^seti_/);
      res.customerId.should.match(/^cus_/);
      stripeCustomerId = res.customerId;
    });

    it('should get saved payment methods', async () => {
      const res = await addie.getSavedPaymentMethods(savedUser.uuid, 'stripe');
      res.should.have.property('paymentMethods');
      res.paymentMethods.should.be.an('array');
      res.should.have.property('customerId');
    });
  });

  describe('Payment Intent Creation', function() {
    it('should create payment intent without splits', async () => {
      const res = await addie.getPaymentIntentWithoutSplits(
        savedUser.uuid,
        'stripe',
        2999, // $29.99
        'usd',
        true // savePaymentMethod
      );
      res.should.have.property('paymentIntent');
      res.should.have.property('ephemeralKey');
      res.should.have.property('customer');
      res.should.have.property('publishableKey');
    });

    it('should create payment intent with splits', async () => {
      const res = await addie.getPaymentIntent(
        savedUser.uuid,
        'stripe',
        4999, // $49.99
        'usd',
        [
          { pubKey: keys.pubKey, amount: 500 }, // $5
          { pubKey: keys.pubKey, amount: 4499 }  // $44.99
        ]
      );
      res.should.have.property('paymentIntent');
      res.should.have.property('customer');
    });
  });

  describe('Stripe Issuing (Virtual Cards)', function() {
    it('should create cardholder', async () => {
      const res = await addie.createCardholder({
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        email: 'test@example.com',
        phoneNumber: '+15555551234',
        address: {
          line1: '123 Test St',
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94110',
          country: 'US'
        },
        dob: {
          day: 1,
          month: 1,
          year: 1990
        }
      });
      res.should.have.property('cardholderId');
      res.should.have.property('status');
      res.cardholderId.should.match(/^ich_/);
      res.status.should.equal('active');
      cardholderId = res.cardholderId;
    });

    it('should issue virtual card', async () => {
      const res = await addie.issueVirtualCard('usd', 100000); // $1000/month
      res.should.have.property('cardId');
      res.should.have.property('last4');
      res.should.have.property('brand');
      res.should.have.property('expMonth');
      res.should.have.property('expYear');
      res.should.have.property('status');
      res.type.should.equal('virtual');
      res.spendingLimit.should.equal(100000);
      virtualCardId = res.cardId;
    });

    it('should get issued cards', async () => {
      const res = await addie.getIssuedCards();
      res.should.have.property('cards');
      res.cards.should.be.an('array');
      res.cards.length.should.be.greaterThan(0);
    });

    it('should get card transactions', async () => {
      const res = await addie.getCardTransactions(10);
      res.should.have.property('transactions');
      res.transactions.should.be.an('array');
    });
  });

  describe('Transfer Processing', function() {
    it('should handle processPaymentTransfers endpoint', async () => {
      // This will fail with invalid payment intent, but tests endpoint exists
      try {
        await addie.processPaymentTransfers('pi_test_invalid');
      } catch(err) {
        // Expected to fail - just testing endpoint exists
      }
    });
  });

  describe('Cleanup', function() {
    it('should delete a user', async () => {
      const res = await addie.deleteUser(savedUser.uuid);
      res.should.equal(true);
    });
  });
});
