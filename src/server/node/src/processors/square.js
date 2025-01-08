import user from '../user/user.js';
import sessionless from 'sessionless-node';
import { default as processorKeys } from '../../config/default-square.js';
import { Client, Environment } from 'square';
const squareKey = processorKeys.squareKey || process.env.SQUARE_KEY;

if(!squareKey) {
  throw new Error('add config!');
}

console.log('processorKeys are', processorKeys);

const client = new Client({
  environment: Environment.Sandbox,
  accessToken: squareKey
});

const squareSDK = {...client.paymentsApi, ...client.customersApi};

const square = {
  putSquareAccount: async (foundUser, country, name, email, ip) => {
    const account = await squareSDK.accounts.create({
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

  getSquarePaymentIntent: async (foundUser, amount, currency, payees) => {
    const customerId = foundUser.squareCustomerId || (await squareSDK.createCustomer({idempotencyKey: crypto.randomUUID()});
    if(foundUser.squareCustomerId !== customerId) {
      foundUser.squareCustomerId = customerId;
      await user.saveUser(foundUser);
    }

    const payment = {
      idempotencyKey: crypto.randomUUID(),
      customerId: foundUser.squareCustomerId,
      sourceId: foundUser.nonce,
      amountMoney: {
	amount: amount + '',
	currency: currency,
      },
    };

    for(const payee of payees) {
        const merchantId = (await user.getUserByPublicKey(payee.pubKey)).squareMerchantId;
        
        await paymentsApi.createPayment({
            sourceId: 'MERCHANT_' + merchantId,
            amountMoney: {
                amount: payee.amount,
                currency: 'USD'
            },
            idempotencyKey: crypto.randomUUID()
        });
    }

    return {
      payment: payment,
      merchantId: process.env.SQUARE_MERCHANT_ID,
      locationId: process.env.SQUARE_LOCATION_ID,
      customerId: customerId 
    };
  },

  getSquarePaymentIntentWithoutSplits: async (foundUser, amount, currency) => {
    const customerId = foundUser.stripeCustomerId || (await squareSDK.customers.create()).id;
    if(foundUser.stripeCustomerId !== customerId) {
      foundUser.stripeCustomerId = customerId;
      await user.saveUser(foundUser);
    }

    const ephemeralKey = await squareSDK.ephemeralKeys.create(
      {customer: customerId},
      {apiVersion: '2024-06-20'}
    );

    const groupName = 'group_' + foundUser.uuid;

    const paymentIntent = await squareSDK.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customerId,
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter
      // is optional because Square enables its functionality by default.
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
	return squareSDK.transfers.create({
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
