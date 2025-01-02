import user from '../user/user.js';
import sessionless from 'sessionless-node';
import { default as processorKeys } from '../../config/default-square.js';
import { Client, Environment } from 'square';
import { randomBytes } from 'crypto';
const squareKey = processorKeys.squareKey || process.env.SQUARE_KEY;

// need to think through this case a bit more
if(!squareKey) {
  const processors = {
    putSquareAccount: async (foundUser, name, email, ip) => {
      foundUser.squareAccountId = 'ff33ee';
      return foundUser;
    },
    getSquarePaymentIntent: async (foundUser, amount, currency, payees) => {
      const response = {
	paymentIntent: 'foo',
	ephemeralKey: 'bar',
	customer: 'baz',
	publishableKey: 'bop'
      };
    
      return response;
    }
  };
}

const squareSDK = new Client({
  accessToken: squareKey,
  environment: Environment.Sandbox
});

const square = {
  putSquareAccount: async (foundUser, country, name, email, ip) => {
    throw new Error('not implemented');
/*    const account = await squareSDK.accounts.create({
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
	square_dashboard: {
	  type: 'none',
	},
      },
    });

    foundUser.squareAccountId = account.id;
    await user.saveUser(foundUser);

    return foundUser; */
  },

  getSquarePaymentIntent: async (foundUser, amount, currency, payees) => {
    const customerId = foundUser.squareCustomerId || (await squareSDK.customers.create()).id;
    if(foundUser.squareCustomerId !== customerId) {
      foundUser.squareCustomerId = customerId;
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

    let accountsAndAmounts = [];
    for(var i = 0; i < payees.length; i++) {
      const payee = payees[i];
      const account = (await user.getUserByPublicKey(payee.pubKey)).squareAccountId;
      accountsAndAmounts.push({
        account,
        amount: payee.amount
      });
    }

    const transferPromises = accountsAndAmounts.map(accountAndAmount => {
      return squareSDK.transfers.create({
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
      publishableKey: squarePublishingKey
    };

    // No, let's do the payment intent, and then resolve the money splitting with MAGIC.
    // We can store value on the user here, and resolve it with magic after creating the splits.

    // let's websocket!
  
    // This needs to happen after the payment is confirmed...
    return response;
  },

  getSquarePaymentIntentWithoutSplits: async (foundUser, amount, currency) => {
    const customerId = foundUser.squareCustomerId || (await squareSDK.customers.create()).id;
    if(foundUser.squareCustomerId !== customerId) {
      foundUser.squareCustomerId = customerId;
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
      publishableKey: squarePublishingKey
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
	const account = (await user.getUserByPublicKey(payee.pubKey)).squareAccountId;
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



export default square;
