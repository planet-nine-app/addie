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
      // Use the pre-signed signatures from spell components
      const contractSignature = spell.components.contractSignature;
      const stepSignature = spell.components.stepSignature;

      if (!contractSignature || !stepSignature) {
        return {
          success: false,
          error: 'Missing required contractSignature and stepSignature in spell components'
        };
      }

      const COVENANT_URL = process.env.COVENANT_URL || 'http://127.0.0.1:3011/';
      const signResponse = await fetch(`${COVENANT_URL}contract/${contractUuid}/sign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          stepSignature,
          signature: contractSignature,
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

  // 🪄 MAGIC-ROUTED ENDPOINTS (No auth needed - resolver authorizes)

  addieUserCreate: async (spell) => {
    try {
      const { pubKey } = spell.components;

      if (!pubKey) {
        return {
          success: false,
          error: 'Missing required field: pubKey'
        };
      }

      const foundUser = await user.putUser({ pubKey });

      return {
        success: true,
        user: foundUser
      };
    } catch (err) {
      console.error('addieUserCreate error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  },

  addieUserProcessor: async (spell) => {
    try {
      const { uuid, processor, country, name, email, ip } = spell.components;

      if (!uuid || !processor || !name || !email) {
        return {
          success: false,
          error: 'Missing required fields: uuid, processor, name, email'
        };
      }

      const foundUser = await user.getUserByUUID(uuid);
      if (!foundUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      let updatedUser = foundUser;

      const processorsModule = await import('../processors/processors.js');
      const processors = processorsModule.default;

      switch (processor) {
        case 'stripe':
          updatedUser = await processors.stripe.putStripeAccount(
            foundUser,
            country,
            name,
            email,
            ip || '127.0.0.1'
          );
          break;
        default:
          return {
            success: false,
            error: 'Processor not found'
          };
      }

      return {
        success: true,
        user: updatedUser
      };
    } catch (err) {
      console.error('addieUserProcessor error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  },

  addieUserProcessorIntent: async (spell) => {
    try {
      const {
        uuid,
        processor,
        amount,
        currency,
        nonce,
        payees,
        savePaymentMethod
      } = spell.components;

      if (!uuid || !processor || !amount || !currency) {
        return {
          success: false,
          error: 'Missing required fields: uuid, processor, amount, currency'
        };
      }

      const foundUser = await user.getUserByUUID(uuid);
      if (!foundUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      foundUser.nonce = nonce;

      const processorsModule = await import('../processors/processors.js');
      const processors = processorsModule.default;

      let paymentTokenResponse;

      switch (processor) {
        case 'stripe':
          paymentTokenResponse = await processors.stripe.getStripePaymentIntent(
            foundUser,
            amount,
            currency,
            payees,
            savePaymentMethod
          );
          break;
        case 'square':
          paymentTokenResponse = await processors.square.getSquarePaymentIntent(
            foundUser,
            amount,
            currency,
            payees,
            savePaymentMethod
          );
          break;
        default:
          return {
            success: false,
            error: 'Processor not found'
          };
      }

      return {
        success: true,
        paymentIntent: paymentTokenResponse
      };
    } catch (err) {
      console.error('addieUserProcessorIntent error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  },

  addieUserProcessorIntentWithoutSplits: async (spell) => {
    try {
      const {
        uuid,
        processor,
        amount,
        currency,
        savePaymentMethod
      } = spell.components;

      if (!uuid || !processor || !amount || !currency) {
        return {
          success: false,
          error: 'Missing required fields: uuid, processor, amount, currency'
        };
      }

      const foundUser = await user.getUserByUUID(uuid);
      if (!foundUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const processorsModule = await import('../processors/processors.js');
      const processors = processorsModule.default;

      let paymentTokenResponse;

      switch (processor) {
        case 'stripe':
          paymentTokenResponse = await processors.stripe.getStripePaymentIntentWithoutSplits(
            foundUser,
            amount,
            currency,
            savePaymentMethod
          );
          break;
        default:
          return {
            success: false,
            error: 'Processor not found'
          };
      }

      return {
        success: true,
        paymentIntent: paymentTokenResponse
      };
    } catch (err) {
      console.error('addieUserProcessorIntentWithoutSplits error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  },

  addieChargeSavedMethod: async (spell) => {
    try {
      const {
        uuid,
        amount,
        currency,
        paymentMethodId,
        payees
      } = spell.components;

      if (!uuid || !amount || !paymentMethodId) {
        return {
          success: false,
          error: 'Missing required fields: uuid, amount, paymentMethodId'
        };
      }

      const foundUser = await user.getUserByUUID(uuid);
      if (!foundUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const processorsModule = await import('../processors/processors.js');
      const processors = processorsModule.default;

      const result = await processors.stripe.chargeWithSavedPaymentMethod(
        foundUser,
        amount,
        currency,
        paymentMethodId,
        payees || []
      );

      return {
        success: true,
        result
      };
    } catch (err) {
      console.error('addieChargeSavedMethod error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  },

  addiePaymentMethodsIntent: async (spell) => {
    try {
      const {
        uuid,
        amount,
        currency,
        payees,
        savePaymentMethod
      } = spell.components;

      if (!uuid || !amount || !currency) {
        return {
          success: false,
          error: 'Missing required fields: uuid, amount, currency'
        };
      }

      const foundUser = await user.getUserByUUID(uuid);
      if (!foundUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const processorsModule = await import('../processors/processors.js');
      const processors = processorsModule.default;

      const savedMethods = await processors.stripe.getSavedPaymentMethods(foundUser);
      const paymentIntent = await processors.stripe.getStripePaymentIntent(
        foundUser,
        amount,
        currency,
        payees,
        savePaymentMethod
      );

      return {
        success: true,
        savedMethods,
        paymentIntent
      };
    } catch (err) {
      console.error('addiePaymentMethodsIntent error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  },

  addieSavedPaymentMethodDelete: async (spell) => {
    try {
      const { uuid, paymentMethodId } = spell.components;

      if (!uuid || !paymentMethodId) {
        return {
          success: false,
          error: 'Missing required fields: uuid, paymentMethodId'
        };
      }

      const foundUser = await user.getUserByUUID(uuid);
      if (!foundUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const processorsModule = await import('../processors/processors.js');
      const processors = processorsModule.default;

      const result = await processors.stripe.removeSavedPaymentMethod(foundUser, paymentMethodId);

      return {
        success: true,
        result
      };
    } catch (err) {
      console.error('addieSavedPaymentMethodDelete error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  },

  addieMoneyProcessor: async (spell) => {
    try {
      const {
        uuid,
        processor,
        caster,
        spellData,
        gatewayUsers
      } = spell.components;

      if (!uuid || !processor || !caster || !spellData) {
        return {
          success: false,
          error: 'Missing required fields: uuid, processor, caster, spellData'
        };
      }

      const foundUser = await user.getUserByUUID(uuid);
      if (!foundUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const addieCaster = await user.getUserByPublicKey(caster.pubKey);
      if (!addieCaster) {
        return {
          success: false,
          error: 'Caster not found'
        };
      }

      if (!addieCaster[processor] || addieCaster[processor].stored < spellData.totalCost) {
        return {
          success: false,
          error: 'Insufficient funds'
        };
      }

      let payees = spellData.gateways.map(payee => {
        const gatewayUser = gatewayUsers.find($ => $.uuid === payee.uuid);
        if (gatewayUser) {
          payee.pubKey = gatewayUser.pubKey;
        }
        return payee;
      });

      const groupName = 'group_' + addieCaster.uuid;

      const processorsModule = await import('../processors/processors.js');
      const processors = processorsModule.default;

      let paidOutResult;

      switch (processor) {
        case 'stripe':
          paidOutResult = await processors.stripe.payPayees(payees, groupName, spellData.totalCost);
          break;
        default:
          return {
            success: false,
            error: 'Processor not found'
          };
      }

      return {
        success: paidOutResult
      };
    } catch (err) {
      console.error('addieMoneyProcessor error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  },

  addieUserDelete: async (spell) => {
    try {
      const { uuid } = spell.components;

      if (!uuid) {
        return {
          success: false,
          error: 'Missing required field: uuid'
        };
      }

      const foundUser = await user.getUserByUUID(uuid);
      if (!foundUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const result = await user.deleteUser(foundUser);

      return {
        success: result
      };
    } catch (err) {
      console.error('addieUserDelete error:', err);
      return {
        success: false,
        error: err.message
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
