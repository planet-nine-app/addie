import sessionless from 'sessionless-node';
import user from '../user/user.js';
import db from '../persistence/db.js';

sessionless.generateKeys(() => {}, db.getKeys);

const fountURL = 'http://localhost:3006/';

const MAGIC = {
  joinup: async (spell) => {
    const gateway = await MAGIC.gatewayForSpell(spell.spellName);
    spell.gateways.push(gateway);
    const spellName = spell.spell;

    const addie = await db.getUser('addie');
    const spellbooks = addie.spellbooks;
    const spellbook = spellbooks.filter(spellbook => spellbook[spellName]).pop();
    if(!spellbook) {
      throw new Error('spellbook not found');
    }

    const spellEntry = spellbook[spellName];
    const currentIndex = spellEntry.destinations.indexOf(spellEntry.destinations.find(($) => $.stopName === 'addie'));
    const nextDestination = spellEntry.destinations[currentIndex + 1].stopURL + spellName;
console.log('sending spell to', nextDestination);

    const res = await MAGIC.forwardSpell(spell, nextDestination);
    const body = await res.json();
 
    if(!body.success) {
      return body;
    }

    const foundUser = await user.putUser(spell.user);
    if(!body.uuids) {
      body.uuids = [];
    }
    body.uuids.push({
      service: 'addie',
      uuid: foundUser.uuid
    });

    return body;
  },

  linkup: async (spell) => {
    const foundUser = await user.getUser(spell.casterUUID);

    if(coordinatingKeys.filter(keys => keys).length !== spell.gateways.length) {
      throw new Error('missing coordinating key');
    }

    const gateway = await MAGIC.gatewayForSpell(spell.spellName);
    gateway.coordinatingKey = {
      serviceURL: 'http://localhost:3005/', // Once hedy is built, this will be dynamic
      uuid: spell.casterUUID,
      pubKey: foundUser.pubKey
    };
    spell.gateways.push(gateway);

    const res = await MAGIC.forwardSpell(spell, fountURL);
    const body = await res.json();
    return body;
  },

  /**
   * signInMoney - Process payment and sign contract step
   *
   * Expected spell components:
   * - contractUuid: UUID of the contract
   * - stepId: ID of the step to sign (typically "Payment Completed")
   * - amount: Amount in cents
   * - processor: Payment processor (e.g., 'stripe')
   * - paymentDetails: Payment-specific details (token, etc.)
   */
  signInMoney: async (spell) => {
    try {
      console.log('🪄 Addie resolving signInMoney spell');

      const {
        contractUuid,
        stepId,
        amount,
        processor,
        paymentDetails
      } = spell.components;

      if (!contractUuid || !stepId || !amount) {
        return {
          success: false,
          error: 'Missing required spell components: contractUuid, stepId, amount'
        };
      }

      // TODO: Process payment through Addie's payment processor
      // For now, we'll simulate a successful payment
      const paymentResult = {
        success: true,
        transactionId: `txn_${Date.now()}`,
        amount,
        processor: processor || 'simulated'
      };

      if (!paymentResult.success) {
        return {
          success: false,
          error: 'Payment processing failed'
        };
      }

      // Sign the contract step using Covenant
      const COVENANT_URL = process.env.COVENANT_URL || 'http://127.0.0.1:3011/';
      const signResponse = await fetch(`${COVENANT_URL}contract/${contractUuid}/sign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          signature: spell.casterSignature,
          timestamp: spell.timestamp,
          userUUID: spell.casterUUID,
          pubKey: spell.components.pubKey || spell.casterPubKey
        })
      });

      if (!signResponse.ok) {
        const error = await signResponse.text();
        console.error('❌ Contract signing failed:', error);
        return {
          success: false,
          error: `Contract signing failed: ${error}`
        };
      }

      const signResult = await signResponse.json();

      console.log('✅ Payment processed and contract step signed:', stepId);

      return {
        success: true,
        payment: paymentResult,
        contractSign: signResult
      };

    } catch (error) {
      console.error('❌ signInMoney spell failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  gatewayForSpell: async (spellName) => {
    const addie = await db.getUser('addie');
    const gateway = {
      timestamp: new Date().getTime() + '',
      uuid: addie.fountUUID, 
      minimumCost: 20,
      ordinal: addie.ordinal
    };      

    const message = gateway.timestamp + gateway.uuid + gateway.minimumCost + gateway.ordinal;

    gateway.signature = await sessionless.sign(message);

    return gateway;
  },

  forwardSpell: async (spell, destination) => {
    return await fetch(destination, {
      method: 'post',
      body: JSON.stringify(spell),
      headers: {'Content-Type': 'application/json'}
    });
  }
};

export default MAGIC;
