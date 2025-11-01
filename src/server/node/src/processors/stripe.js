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

  getStripePaymentIntent: async (foundUser, amount, currency, payees, savePaymentMethod = false) => {
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

    // Validate and prepare payee data for metadata
    let payeeMetadata = {};
    if(payees && payees.length > 0) {
      // Validate that all payees have Stripe accounts
      for(var i = 0; i < payees.length; i++) {
        const payee = payees[i];
        try {
          const payeeUser = await user.getUserByPublicKey(payee.pubKey);
          if(!payeeUser.stripeAccountId) {
            console.warn(`⚠️ Payee ${payee.pubKey} does not have a Stripe account, skipping`);
            continue;
          }
          // Store payee info in metadata (Stripe metadata has 500 char limit per value)
          payeeMetadata[`payee_${i}_pubkey`] = payee.pubKey;
          payeeMetadata[`payee_${i}_amount`] = payee.amount.toString();
        } catch(err) {
          console.warn(`⚠️ Payee ${payee.pubKey} not found in system, skipping`);
        }
      }
      payeeMetadata.payee_count = Object.keys(payeeMetadata).filter(k => k.endsWith('_pubkey')).length.toString();
    }

    const paymentIntentData = {
      amount: amount,
      currency: currency,
      customer: customerId,
      automatic_payment_methods: {
	enabled: true,
      },
      transfer_group: groupName,
      metadata: payeeMetadata // Store payee info for post-payment processing
    };

    if(savePaymentMethod) {
      paymentIntentData.setup_future_usage = 'off_session';
    }

    const paymentIntent = await stripeSDK.paymentIntents.create(paymentIntentData);

    console.log(`✅ Payment intent created: ${paymentIntent.id}`);
    console.log(`💰 Payee metadata stored for ${payeeMetadata.payee_count || 0} payees`);
    console.log(`⏳ Transfers will be created after payment confirmation`);

    const response = {
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: stripePublishingKey
    };

    return response;
  },

  getStripePaymentIntentWithoutSplits: async (foundUser, amount, currency, savePaymentMethod = false) => {
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

    const paymentIntentData = {
      amount: amount,
      currency: currency,
      customer: customerId,
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter
      // is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
	enabled: true,
      },
      transfer_group: groupName
    };

    if(savePaymentMethod) {
      paymentIntentData.setup_future_usage = 'off_session';
    }

    const paymentIntent = await stripeSDK.paymentIntents.create(paymentIntentData);

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

  getSavedPaymentMethods: async (foundUser, type = 'card') => {
    if(!foundUser.stripeCustomerId) {
      return { paymentMethods: [] };
    }

    try {
      const allPaymentMethods = await stripeSDK.paymentMethods.list({
        customer: foundUser.stripeCustomerId,
        type: type
      });

      const paymentMethods = allPaymentMethods.data.filter(pm => {
        return pm.allow_redisplay === 'always';
      });

      return {
        paymentMethods,
        customerId: foundUser.stripeCustomerId
      };
    } catch(error) {
console.error('Error fetching payment methods:', error);
      throw error;
    }
  },

  chargeWithSavedPaymentMethod: async (foundUser, amount, currency, paymentMethodId, payees = []) => {
    if(!foundUser.stripeCustomerId) {
      throw new Error('Customer not found');
    }

    const groupName = 'group_' + foundUser.uuid;

    try {
      const paymentIntentData = {
        amount,
        currency,
        customer: foundUser.stripeCustomerId,
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        off_session: true,
        transfer_group: groupName
      };

      const paymentIntent = await stripeSDK.paymentIntents.create(paymentIntentData);

      if(payees.length > 0) {
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
      }

      return {
        success: true,
        paymentIntent,
        status: paymentIntent.status
      };
    } catch(err) {
      if(err.code === 'authentication_required') {
        return {
          success: false,
          requiresAuthentication: true,
          paymentIntent: {
            id: err.payment_intent.id,
            client_secret: err.payment_intent.client_secret
          }
        };
      }
console.error('Error charging saved payment method', err);
      throw err;
    }
  },

  removeSavedPaymentMethod: async (foundUser, paymentMethodId) => {
    try {
      const paymentMethod = await stripeSDK.paymentMethods.detach(paymentMethodId);

      return {
        success: true
      }
    } catch(err) {
console.error('error removing payment method', err);
      throw err;
    }
  },

  createSetupIntent: async (foundUser, customerId = null) => {
    try {
      // Create or use existing customer
      const actualCustomerId = customerId || foundUser.stripeCustomerId || (await stripeSDK.customers.create()).id;

      // Save customer ID if new
      if(foundUser.stripeCustomerId !== actualCustomerId) {
        foundUser.stripeCustomerId = actualCustomerId;
        await user.saveUser(foundUser);
      }

      // Create SetupIntent
      const setupIntent = await stripeSDK.setupIntents.create({
        customer: actualCustomerId,
        payment_method_types: ['card'],
        usage: 'off_session', // For future payments
      });

      return {
        clientSecret: setupIntent.client_secret,
        customerId: actualCustomerId,
        publishableKey: stripePublishingKey
      };
    } catch(err) {
console.error('Error creating SetupIntent:', err);
      throw err;
    }
  },

  // Stripe Issuing - Create a cardholder for the unbanked
  createCardholder: async (foundUser, individualInfo) => {
    try {
      const { name, email, phoneNumber, address } = individualInfo;

      // Create Stripe Issuing Cardholder
      const cardholder = await stripeSDK.issuing.cardholders.create({
        type: 'individual',
        name: name,
        email: email,
        phone_number: phoneNumber,
        billing: {
          address: {
            line1: address.line1,
            line2: address.line2 || null,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: address.country || 'US'
          }
        },
        individual: {
          first_name: individualInfo.firstName,
          last_name: individualInfo.lastName,
          dob: {
            day: individualInfo.dob.day,
            month: individualInfo.dob.month,
            year: individualInfo.dob.year
          }
        },
        status: 'active'
      });

      // Save cardholder ID to user
      foundUser.stripeCardholderId = cardholder.id;
      await user.saveUser(foundUser);

console.log('Created Stripe Issuing cardholder:', cardholder.id);

      return {
        cardholderId: cardholder.id,
        status: cardholder.status
      };
    } catch(err) {
console.error('Error creating cardholder:', err);
      throw err;
    }
  },

  // Issue a virtual card
  issueVirtualCard: async (foundUser, currency = 'usd', spendingLimit = null) => {
    try {
      if(!foundUser.stripeCardholderId) {
        throw new Error('User must have a cardholder account first');
      }

      // Default spending limit: $1000/month
      const monthlyLimit = spendingLimit || 100000; // in cents

      const card = await stripeSDK.issuing.cards.create({
        cardholder: foundUser.stripeCardholderId,
        currency: currency,
        type: 'virtual',
        status: 'active',
        spending_controls: {
          spending_limits: [
            {
              amount: monthlyLimit,
              interval: 'monthly'
            }
          ]
        }
      });

console.log('Issued virtual card:', card.id, 'with limit:', monthlyLimit);

      return {
        cardId: card.id,
        last4: card.last4,
        brand: card.brand,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        status: card.status,
        type: 'virtual',
        spendingLimit: monthlyLimit,
        // Virtual card details (number, CVC, etc.) can be retrieved via API
        cardNumber: card.number, // Only available immediately after creation
        cvc: card.cvc
      };
    } catch(err) {
console.error('Error issuing virtual card:', err);
      throw err;
    }
  },

  // Issue a physical card
  issuePhysicalCard: async (foundUser, shippingAddress, currency = 'usd') => {
    try {
      if(!foundUser.stripeCardholderId) {
        throw new Error('User must have a cardholder account first');
      }

      const card = await stripeSDK.issuing.cards.create({
        cardholder: foundUser.stripeCardholderId,
        currency: currency,
        type: 'physical',
        status: 'active',
        shipping: {
          name: shippingAddress.name,
          address: {
            line1: shippingAddress.line1,
            line2: shippingAddress.line2 || null,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postal_code: shippingAddress.postal_code,
            country: shippingAddress.country || 'US'
          },
          service: 'standard' // or 'express', 'priority'
        },
        spending_controls: {
          spending_limits: [
            {
              amount: 100000, // $1000 per month default limit
              interval: 'monthly'
            }
          ]
        }
      });

console.log('Issued physical card:', card.id);

      return {
        cardId: card.id,
        last4: card.last4,
        brand: card.brand,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        status: card.status,
        type: 'physical',
        shipping: card.shipping
      };
    } catch(err) {
console.error('Error issuing physical card:', err);
      throw err;
    }
  },

  // Get issued cards for a user
  getIssuedCards: async (foundUser) => {
    try {
      if(!foundUser.stripeCardholderId) {
        return { cards: [] };
      }

      const cards = await stripeSDK.issuing.cards.list({
        cardholder: foundUser.stripeCardholderId,
        limit: 100
      });

      return {
        cards: cards.data.map(card => ({
          cardId: card.id,
          last4: card.last4,
          brand: card.brand,
          expMonth: card.exp_month,
          expYear: card.exp_year,
          status: card.status,
          type: card.type,
          spendingLimit: card.spending_controls?.spending_limits?.[0]?.amount
        }))
      };
    } catch(err) {
console.error('Error fetching issued cards:', err);
      throw err;
    }
  },

  // Retrieve virtual card details (number, CVC) - sensitive operation
  getVirtualCardDetails: async (foundUser, cardId) => {
    try {
      const card = await stripeSDK.issuing.cards.retrieve(cardId);

      if(card.cardholder !== foundUser.stripeCardholderId) {
        throw new Error('Card does not belong to this user');
      }

      if(card.type !== 'virtual') {
        throw new Error('Can only retrieve details for virtual cards');
      }

      return {
        cardId: card.id,
        number: card.number,
        cvc: card.cvc,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        last4: card.last4,
        brand: card.brand
      };
    } catch(err) {
console.error('Error retrieving virtual card details:', err);
      throw err;
    }
  },

  // Cancel/freeze a card
  updateCardStatus: async (foundUser, cardId, status) => {
    try {
      const card = await stripeSDK.issuing.cards.retrieve(cardId);

      if(card.cardholder !== foundUser.stripeCardholderId) {
        throw new Error('Card does not belong to this user');
      }

      const updatedCard = await stripeSDK.issuing.cards.update(cardId, {
        status: status // 'active', 'inactive', 'canceled'
      });

console.log('Updated card status:', cardId, status);

      return {
        cardId: updatedCard.id,
        status: updatedCard.status
      };
    } catch(err) {
console.error('Error updating card status:', err);
      throw err;
    }
  },

  // Get transactions for all user's cards
  getTransactions: async (foundUser, limit = 10) => {
    try {
      if(!foundUser.stripeCardholderId) {
        return { transactions: [] };
      }

      const transactions = await stripeSDK.issuing.transactions.list({
        cardholder: foundUser.stripeCardholderId,
        limit: limit
      });

console.log('Retrieved transactions:', transactions.data.length);

      return {
        transactions: transactions.data.map(tx => ({
          id: tx.id,
          amount: tx.amount,
          merchant: tx.merchant_data?.name || 'Unknown merchant',
          category: tx.merchant_data?.category || 'other',
          status: tx.status,
          created: tx.created,
          cardId: tx.card,
          currency: tx.currency
        }))
      };
    } catch(err) {
console.error('Error fetching transactions:', err);
      throw err;
    }
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
  },

  /**
   * Process transfers after payment confirmation
   * Called from webhook or client-side after payment succeeds
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @returns {Object} Result with transfer details
   */
  processPaymentTransfers: async (paymentIntentId) => {
    try {
      console.log(`💰 Processing transfers for payment: ${paymentIntentId}`);

      // Retrieve the payment intent to get metadata and transfer group
      const paymentIntent = await stripeSDK.paymentIntents.retrieve(paymentIntentId);

      // Check payment status
      if(paymentIntent.status !== 'succeeded') {
        console.warn(`⚠️ Payment ${paymentIntentId} has not succeeded (status: ${paymentIntent.status})`);
        return {
          success: false,
          error: `Payment not succeeded (status: ${paymentIntent.status})`
        };
      }

      const metadata = paymentIntent.metadata;
      const transferGroup = paymentIntent.transfer_group;
      const payeeCount = parseInt(metadata.payee_count || '0');

      if(payeeCount === 0) {
        console.log(`ℹ️ No payees for payment ${paymentIntentId}`);
        return {
          success: true,
          transfers: [],
          message: 'No payees to transfer to'
        };
      }

      console.log(`👥 Processing transfers for ${payeeCount} payees`);

      // Extract payee info from metadata
      let transfers = [];
      for(let i = 0; i < payeeCount; i++) {
        const pubKey = metadata[`payee_${i}_pubkey`];
        const amount = parseInt(metadata[`payee_${i}_amount`]);

        if(!pubKey || !amount) {
          console.warn(`⚠️ Missing payee data for index ${i}`);
          continue;
        }

        try {
          // Look up payee's Stripe account
          const payeeUser = await user.getUserByPublicKey(pubKey);
          if(!payeeUser.stripeAccountId) {
            console.warn(`⚠️ Payee ${pubKey} does not have a Stripe account, skipping transfer`);
            continue;
          }

          // Create transfer
          console.log(`💸 Transferring ${amount} cents to ${pubKey.substring(0, 10)}...`);
          const transfer = await stripeSDK.transfers.create({
            amount: amount,
            currency: 'usd',
            destination: payeeUser.stripeAccountId,
            transfer_group: transferGroup,
            description: `Payment from ${paymentIntentId}`
          });

          transfers.push({
            pubKey: pubKey,
            amount: amount,
            transferId: transfer.id,
            destination: payeeUser.stripeAccountId
          });

          console.log(`✅ Transfer created: ${transfer.id}`);
        } catch(err) {
          console.error(`❌ Failed to transfer to ${pubKey}:`, err.message);
          transfers.push({
            pubKey: pubKey,
            amount: amount,
            error: err.message
          });
        }
      }

      console.log(`✅ Processed ${transfers.filter(t => t.transferId).length}/${payeeCount} transfers successfully`);

      return {
        success: true,
        transfers: transfers,
        paymentIntentId: paymentIntentId,
        totalTransfers: transfers.filter(t => t.transferId).length,
        failedTransfers: transfers.filter(t => t.error).length
      };
    } catch(err) {
      console.error('❌ Error processing payment transfers:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }
};

export default stripe;
