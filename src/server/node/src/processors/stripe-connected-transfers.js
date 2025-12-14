/**
 * Process transfers to Stripe Connected Accounts
 * (For platforms receiving revenue splits, not affiliate payouts to cards)
 */

import user from '../user/user.js';
import _stripe from 'stripe';

const stripeSDK = _stripe(process.env.STRIPE_KEY);

const processConnectedAccountTransfers = async (paymentIntentId) => {
  try {
    console.log(`💰 Processing Connected Account transfers for payment: ${paymentIntentId}`);

    // Retrieve the payment intent to get metadata and transfer group
    const paymentIntent = await stripeSDK.paymentIntents.retrieve(paymentIntentId);

    // Check payment status
    if (paymentIntent.status !== 'succeeded') {
      console.warn(`⚠️ Payment ${paymentIntentId} has not succeeded (status: ${paymentIntent.status})`);
      return {
        success: false,
        error: `Payment not succeeded (status: ${paymentIntent.status})`
      };
    }

    const metadata = paymentIntent.metadata;
    const transferGroup = paymentIntent.transfer_group;
    const payeeCount = parseInt(metadata.payee_count || '0');

    if (payeeCount === 0) {
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
    for (let i = 0; i < payeeCount; i++) {
      const pubKey = metadata[`payee_${i}_pubkey`];
      const amount = parseInt(metadata[`payee_${i}_amount`]);
      const name = metadata[`payee_${i}_name`] || `Payee ${i + 1}`;

      if (!pubKey || !amount) {
        console.warn(`⚠️ Missing payee data for index ${i}`);
        continue;
      }

      try {
        // Fetch payee user by pubKey
        const payeeUser = await user.getUserByPublicKey(pubKey);

        if (!payeeUser || !payeeUser.stripeAccountId) {
          console.warn(`⚠️ Payee ${pubKey} does not have a Stripe Connected Account, skipping transfer`);
          transfers.push({
            pubKey: pubKey,
            amount: amount,
            error: 'No Stripe Connected Account'
          });
          continue;
        }

        // Build transfer description
        const productName = metadata.product_name || 'Product';
        const transferDescription = `${productName} - Revenue split to ${name}`;

        // Build transfer metadata
        const transferMetadata = {
          product_name: metadata.product_name || 'Unknown product',
          payee_name: name,
          payee_pubkey: pubKey.substring(0, 20), // Truncate for metadata limit
          original_payment_intent: paymentIntentId
        };

        // Create transfer to Connected Account
        console.log(`💸 Transferring ${amount} cents to ${name} (${pubKey.substring(0, 10)}...)`);
        const transfer = await stripeSDK.transfers.create({
          amount: amount,
          currency: 'usd',
          destination: payeeUser.stripeAccountId,
          transfer_group: transferGroup,
          description: transferDescription,
          metadata: transferMetadata
        });

        transfers.push({
          pubKey: pubKey,
          name: name,
          amount: amount,
          transferId: transfer.id,
          destination: payeeUser.stripeAccountId
        });

        console.log(`✅ Transfer created: ${transfer.id} (${transferDescription})`);
      } catch (err) {
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
  } catch (err) {
    console.error('❌ Error processing Connected Account transfers:', err);
    return {
      success: false,
      error: err.message
    };
  }
};

export default { processConnectedAccountTransfers };
