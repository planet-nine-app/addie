import user from '../user/user.js';
import sessionless from 'sessionless-node';
import _stripe from 'stripe';
const stripeKey = process.env.STRIPE_KEY;
const stripePublishingKey = process.env.STRIPE_PUBLISHING_KEY;

console.log('stripeKey', stripeKey);

// need to think through this case a bit more
if(!stripeKey) {
  const processors = {
    putStripeAccount: async (foundUser, name, email, ip) => {
      foundUser.stripeAccountId = 'ff33ee';
      return foundUser;
    },
    getStripePaymentIntent: async (foundUser, amount, currency, payees) => {
      const response = {
	paymentIntent: 'foo',
	ephemeralKey: 'bar',
	customer: 'baz',
	publishableKey: stripePublishingKey
      };
    
      return response;
    }
  };
}

const stripeSDK = _stripe(stripeKey);

const stripe = {
  putStripeAccount: async (foundUser, country, name, email, ip) => {
    const account = await stripeSDK.accounts.create({
      country: country,
      email: email,
      business_type: 'individual',
      tos_acceptance: {
        date: Math.floor((new Date().getTime()) / 1000),
        ip: ip,
        service_agreement: 'full'
      },
      capabilities: {
        transfers: {
          requested: true
        }
      },
      controller: {
	fees: {
	  payer: 'application',
	},
	losses: {
	  payments: 'application',
	},
        requirement_collection: 'application',
	stripe_dashboard: {
	  type: 'none',
	},
      },
    });

    foundUser.stripeAccountId = account.id;
    await user.saveUser(foundUser);

    return foundUser;
  },

  getStripePaymentIntent: async (foundUser, amount, currency, payees) => {
    const customerId = foundUser.stripeCustomerId || (await stripeSDK.customers.create()).id;
    if(foundUser.stripeCustomerId !== customerId) {
      foundUser.stripeCustomerId = customerId;
      await user.saveUser(foundUser);
    }

    const ephemeralKey = await stripeSDK.ephemeralKeys.create(
      {customer: customerId},
      {apiVersion: '2024-06-20'}
    );

    const groupName = 'group_' + foundUser.uuid;

    const paymentIntent = await stripeSDK.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customerId,
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter
      // is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
	enabled: true,
      },
      transfer_group: groupName
    });

    let accountsAndAmounts = [];
    for(var i = 0; i < payees.length; i++) {
      const payee = payees[i];
      const account = (await user.getUserByPublicKey(payee.pubKey)).stripeAccountId;
      accountsAndAmounts.push({
        account,
        amount: payee.amount
      });
    }

    const transferPromises = accountsAndAmounts.map(accountAndAmount => {
      return stripeSDK.transfers.create({
	amount: accountAndAmount.amount,
	currency: 'usd',
	destination: accountAndAmount.account,
	transfer_group: groupName
      });
    });
    await Promise.all(transferPromises);
console.log('transferPromises');
console.log('sending');
    const response = {
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: stripePublishingKey
    };

    // No, let's do the payment intent, and then resolve the money splitting with MAGIC.
    // We can store value on the user here, and resolve it with magic after creating the splits.

    // let's websocket!
  
    // This needs to happen after the payment is confirmed...
    return response;
  },

  getStripePaymentIntentWithoutSplits: async (foundUser, amount, currency) => {
    const customerId = foundUser.stripeCustomerId || (await stripeSDK.customers.create()).id;
    if(foundUser.stripeCustomerId !== customerId) {
      foundUser.stripeCustomerId = customerId;
      await user.saveUser(foundUser);
    }

    const ephemeralKey = await stripeSDK.ephemeralKeys.create(
      {customer: customerId},
      {apiVersion: '2024-06-20'}
    );

    const groupName = 'group_' + foundUser.uuid;

    const paymentIntent = await stripeSDK.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customerId,
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter
      // is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
	enabled: true,
      },
      transfer_group: groupName
    });

    const response = {
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: stripePublishingKey
    };

    return response;
  },

  getSubscriptionPaymentIntent:  async (foundUser, amount, currency, subscriptionId, payees) => {
    const customerId = foundUser.stripeCustomerId || (await stripeSDK.customers.create()).id;
    if(foundUser.stripeCustomerId !== customerId) {
      foundUser.stripeCustomerId = customerId;
      await user.saveUser(foundUser);
    }

    const ephemeralKey = await stripeSDK.ephemeralKeys.create(
      {customer: customerId},
      {apiVersion: '2024-06-20'}
    );

    const groupName = 'group_' + foundUser.uuid;

    const paymentIntent = await stripeSDK.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customerId,
      setup_future_usage: 'off_session',
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter
      // is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
	enabled: true,
      },
      metadata: {
        subscription_id: subscriptionId
      },
      transfer_group: groupName
    });

    let accountsAndAmounts = [];
    for(var i = 0; i < payees.length; i++) {
      const payee = payees[i];
      const account = (await user.getUserByPublicKey(payee.pubKey)).stripeAccountId;
      accountsAndAmounts.push({
        account,
        amount: payee.amount
      });
    }

    const transferPromises = accountsAndAmounts.map(accountAndAmount => {
      return stripeSDK.transfers.create({
	amount: accountAndAmount.amount,
	currency: 'usd',
	destination: accountAndAmount.account,
	transfer_group: groupName
      });
    });
    await Promise.all(transferPromises);
console.log('transferPromises');
console.log('sending');
    const response = {
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: stripePublishingKey
    };

    // No, let's do the payment intent, and then resolve the money splitting with MAGIC.
    // We can store value on the user here, and resolve it with magic after creating the splits.

    // let's websocket!
  
    // This needs to happen after the payment is confirmed...
    return response;
  },



  payPayees: async (payees, groupName, amount) => {
console.log('payees', payees);
    const paidOutAmount = payees.reduce((a, c) => a + (c.minimumCost - c.minimumCost * 0.05), 0);
console.log('paidOutAmount', paidOutAmount);
console.log('amount', amount);
    if(paidOutAmount > amount) {
      return false;
    }
    try {
      let accountsAndAmounts = [];
      for(var i = 0; i < payees.length; i++) {
	const payee = payees[i];
	const account = (await user.getUserByPublicKey(payee.pubKey)).stripeAccountId;
	accountsAndAmounts.push({
	  account,
	  amount: (payee.minimumCost - payee.minimumCost * 0.05)
	});
      }
console.log('accountsAndAmounrs', accountsAndAmounts);

      const transferPromises = accountsAndAmounts.map(accountAndAmount => {
	return stripeSDK.transfers.create({
	  amount: accountAndAmount.amount,
	  currency: 'usd',
	  destination: accountAndAmount.account,
	  transfer_group: groupName
	});
      });
      const promResults = await Promise.all(transferPromises);
console.log(promResults);

      return true;
    } catch(err) {
console.warn(err);
      return false;
    }
  }
};



export default stripe;
