import user from '../user/user.js';
import db from '../persistence/db.js';

const processors = {
  putStripeAccount: async (foundUser, name, email, ip) => {
    const account = await stripeSDK.accounts.create({
      country: 'US',
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
    const customerId = foundUser.stripeAccountId || (await stripeSDK.customers.create()).id;
    if(foundUser.stripeAccountId !== customerId) {
      foundUser.stripeAccountId = customerId;
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

    let accountsAndAmounts;
    for(var i = 0; i < payees.count; i++) {
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
  
    return response;
  }
};

export default processors;