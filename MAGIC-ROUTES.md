# Addie MAGIC-Routed Endpoints

## Overview

Addie now supports MAGIC-routed versions of all POST, PUT, and DELETE operations. These spells route through Fount (the resolver) for centralized authentication. Addie handles payment processing, payment method management, and financial transactions for the Planet Nine ecosystem.

## Converted Routes

### 1. Create User
**Direct Route**: `PUT /user/create`
**MAGIC Spell**: `addieUserCreate`
**Cost**: 50 MP

**Components**:
```javascript
{
  pubKey: "user-public-key"
}
```

**Returns**:
```javascript
{
  success: true,
  user: {
    uuid: "user-uuid",
    pubKey: "user-public-key"
  }
}
```

**Validation**:
- Requires pubKey

---

### 2. Set Payment Processor
**Direct Route**: `PUT /user/:uuid/processor/:processor`
**MAGIC Spell**: `addieUserProcessor`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "user-uuid",
  processor: "stripe", // Currently supports: stripe
  country: "US",
  name: "User Name",
  email: "user@example.com",
  ip: "127.0.0.1" // Optional: defaults to 127.0.0.1
}
```

**Returns**:
```javascript
{
  success: true,
  user: {
    uuid: "user-uuid",
    pubKey: "user-public-key",
    stripe: {
      // Stripe account details
    }
  }
}
```

**Validation**:
- Requires uuid, processor, name, and email
- User must exist
- Currently only supports 'stripe' processor

---

### 3. Create Payment Intent (With Splits)
**Direct Route**: `POST /user/:uuid/processor/:processor/intent`
**MAGIC Spell**: `addieUserProcessorIntent`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "user-uuid",
  processor: "stripe", // or "square"
  amount: 1999, // Amount in cents ($19.99)
  currency: "usd",
  nonce: "payment-nonce", // Optional: processor-specific
  payees: [
    {
      uuid: "payee-uuid",
      amount: 199 // 10% split
    }
  ],
  savePaymentMethod: true // Optional: save payment method for future use
}
```

**Returns**:
```javascript
{
  success: true,
  paymentIntent: {
    client_secret: "pi_..._secret_...",
    // ... other payment intent details from processor
  }
}
```

**Validation**:
- Requires uuid, processor, amount, and currency
- User must exist
- Supports Stripe and Square processors
- Payees are optional for payment splitting

---

### 4. Create Payment Intent (Without Splits)
**Direct Route**: `POST /user/:uuid/processor/:processor/intent-without-splits`
**MAGIC Spell**: `addieUserProcessorIntentWithoutSplits`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "user-uuid",
  processor: "stripe",
  amount: 1999, // Amount in cents ($19.99)
  currency: "usd",
  savePaymentMethod: false // Optional: save payment method for future use
}
```

**Returns**:
```javascript
{
  success: true,
  paymentIntent: {
    client_secret: "pi_..._secret_...",
    // ... other payment intent details from Stripe
  }
}
```

**Validation**:
- Requires uuid, processor, amount, and currency
- User must exist
- Currently only supports 'stripe' processor
- No payment splitting - full amount goes to merchant

---

### 5. Charge with Saved Payment Method
**Direct Route**: `POST /charge-with-saved-method`
**MAGIC Spell**: `addieChargeSavedMethod`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "user-uuid",
  amount: 1999, // Amount in cents ($19.99)
  currency: "usd",
  paymentMethodId: "pm_...", // Stripe payment method ID
  payees: [
    {
      uuid: "payee-uuid",
      amount: 199 // 10% split
    }
  ]
}
```

**Returns**:
```javascript
{
  success: true,
  result: {
    // Charge result from Stripe
  }
}
```

**Validation**:
- Requires uuid, amount, and paymentMethodId
- User must exist
- Payment method must belong to user
- Payees are optional for payment splitting

---

### 6. Get Saved Payment Methods and Create Intent
**Direct Route**: `POST /payment-methods-and-intent`
**MAGIC Spell**: `addiePaymentMethodsIntent`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "user-uuid",
  amount: 1999, // Amount in cents ($19.99)
  currency: "usd",
  payees: [
    {
      uuid: "payee-uuid",
      amount: 199
    }
  ],
  savePaymentMethod: true // Optional
}
```

**Returns**:
```javascript
{
  success: true,
  savedMethods: [
    {
      id: "pm_...",
      type: "card",
      card: {
        brand: "visa",
        last4: "4242",
        exp_month: 12,
        exp_year: 2025
      }
    }
  ],
  paymentIntent: {
    client_secret: "pi_..._secret_...",
    // ... other payment intent details
  }
}
```

**Validation**:
- Requires uuid, amount, and currency
- User must exist
- Returns both saved payment methods and new payment intent
- Useful for checkout flows with saved payment method options

---

### 7. Delete Saved Payment Method
**Direct Route**: `DELETE /saved-payment-methods/:paymentMethodId`
**MAGIC Spell**: `addieSavedPaymentMethodDelete`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "user-uuid",
  paymentMethodId: "pm_..." // Stripe payment method ID
}
```

**Returns**:
```javascript
{
  success: true,
  result: {
    // Deletion result from Stripe
  }
}
```

**Validation**:
- Requires uuid and paymentMethodId
- User must exist
- Payment method must belong to user

---

### 8. Process Money/Gateway Payments
**Direct Route**: `POST /money/processor/:processor/user/:uuid`
**MAGIC Spell**: `addieMoneyProcessor`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "user-uuid",
  processor: "stripe",
  caster: {
    pubKey: "caster-public-key"
  },
  spellData: {
    totalCost: 100, // MP cost
    gateways: [
      {
        uuid: "gateway-uuid",
        amount: 10 // 10% of total cost
      }
    ]
  },
  gatewayUsers: [
    {
      uuid: "gateway-uuid",
      pubKey: "gateway-public-key"
    }
  ]
}
```

**Returns**:
```javascript
{
  success: true // or false if insufficient funds or payout failed
}
```

**Validation**:
- Requires uuid, processor, caster, and spellData
- User must exist
- Caster must exist and have sufficient funds
- Checks caster's stored balance for processor
- Distributes payments to gateway participants
- Currently only supports 'stripe' processor

**Implementation Notes**:
- This spell handles the financial distribution for MAGIC protocol gateway rewards
- Verifies caster has sufficient stored funds before processing
- Creates payment group using caster's UUID
- Distributes funds to all gateway participants

---

### 9. Delete User
**Direct Route**: `DELETE /user/:uuid`
**MAGIC Spell**: `addieUserDelete`
**Cost**: 50 MP

**Components**:
```javascript
{
  uuid: "user-uuid"
}
```

**Returns**:
```javascript
{
  success: true // or false if deletion failed
}
```

**Validation**:
- Requires uuid
- User must exist

---

## Implementation Details

### File Changes

1. **`/src/server/node/src/magic/magic.js`** - Added nine new spell handlers:
   - `addieUserCreate(spell)`
   - `addieUserProcessor(spell)`
   - `addieUserProcessorIntent(spell)`
   - `addieUserProcessorIntentWithoutSplits(spell)`
   - `addieChargeSavedMethod(spell)`
   - `addiePaymentMethodsIntent(spell)`
   - `addieSavedPaymentMethodDelete(spell)`
   - `addieMoneyProcessor(spell)`
   - `addieUserDelete(spell)`

2. **`/fount/src/server/node/spellbooks/spellbook.js`** - Added spell definitions with destinations and costs

3. **`/test/mocha/magic-spells.js`** - New test file with comprehensive spell tests

4. **`/test/mocha/package.json`** - Added `fount-js` dependency

### Authentication Flow

```
Client → Fount (resolver) → Addie MAGIC handler → Business logic
           ↓
    Verifies signature
    Deducts MP
    Grants experience
    Grants nineum
```

**Before (Direct REST)**:
- Client signs request
- Addie verifies signature directly
- Addie executes business logic

**After (MAGIC Spell)**:
- Client signs spell
- Fount verifies signature & deducts MP
- Fount grants experience & nineum to caster
- Fount forwards to Addie
- Addie executes business logic (no auth needed)

### Naming Convention

Route path → Spell name transformation:
```
/user/create                                  → addieUserCreate
/user/:uuid/processor/:processor              → addieUserProcessor
/user/:uuid/processor/:processor/intent       → addieUserProcessorIntent
/user/:uuid/processor/:processor/intent-without-splits → addieUserProcessorIntentWithoutSplits
/charge-with-saved-method                     → addieChargeSavedMethod
/payment-methods-and-intent                   → addiePaymentMethodsIntent
/saved-payment-methods/:paymentMethodId       → addieSavedPaymentMethodDelete
/money/processor/:processor/user/:uuid        → addieMoneyProcessor
/user/:uuid                                   → addieUserDelete
```

Pattern: `[service][PathWithoutSlashesAndParams]`

### Payment Processing

Addie provides comprehensive payment processing for Planet Nine:

**Payment Processors**:
- **Stripe**: Full support for payment intents, saved methods, and payouts
- **Square**: Support for payment intents (in development)
- **Future**: Additional processor support planned

**Payment Flows**:
1. **Simple Checkout**: Create payment intent without splits
2. **Split Payments**: Create payment intent with multiple payees
3. **Saved Methods**: Charge using previously saved payment methods
4. **Combined Flow**: Get saved methods and create intent in one call

**Payment Method Management**:
- Save payment methods for future use
- Retrieve all saved payment methods for a user
- Delete individual payment methods
- Automatic Stripe customer creation

### Gateway Reward Distribution

Addie handles financial distribution for the MAGIC protocol:

**Gateway Payment Flow**:
```
1. Spell is cast with MP cost
2. Fount deducts MP from caster
3. Gateway participants are identified
4. addieMoneyProcessor spell distributes funds
5. Each gateway receives their percentage
6. Funds stored in gateway user accounts
```

**Requirements**:
- Caster must have sufficient funds stored with processor
- Gateway users must have Addie accounts
- Payment group created per caster
- Percentage-based distribution

**Example**:
```javascript
// Spell costs 100 MP
// 3 gateways, each gets 10% (10 MP worth)
{
  spellData: {
    totalCost: 100,
    gateways: [
      { uuid: 'gateway1', amount: 10 },
      { uuid: 'gateway2', amount: 10 },
      { uuid: 'gateway3', amount: 10 }
    ]
  }
}
```

### Stripe Integration

Addie's Stripe integration provides:

**Account Management**:
- Automatic customer creation
- Account linking for users
- IP tracking for fraud prevention
- Country-specific account setup

**Payment Intents**:
- Standard payment intents
- Payment intents with Connect splits
- Automatic payment method saving
- Multi-currency support

**Saved Payment Methods**:
- List all payment methods for customer
- Attach new payment methods
- Detach (delete) payment methods
- Charge with saved methods

**Payouts**:
- Stripe Connect payouts to gateway participants
- Group-based payout management
- Percentage-based distribution
- Automatic account creation for payees

### Error Handling

All spell handlers return consistent error format:
```javascript
{
  success: false,
  error: "Error description"
}
```

**Common Errors**:
- Missing required fields
- User not found
- Caster not found
- Insufficient funds
- Processor not found
- Payment processing failed
- Invalid payment method

## Testing

Run MAGIC spell tests:
```bash
cd addie/test/mocha
npm install
npm test magic-spells.js
```

Test coverage:
- ✅ User creation via spell
- ✅ Processor configuration via spell
- ✅ Payment intent creation via spell (without splits)
- ✅ Missing pubKey validation
- ✅ Missing processor fields validation
- ✅ Missing payment intent fields validation
- ✅ Missing charge saved method fields validation
- ✅ Missing payment methods intent fields validation
- ✅ Missing payment method delete fields validation
- ✅ Missing money processor fields validation

## Benefits

1. **No Direct Authentication**: Addie handlers don't need to verify signatures
2. **Centralized Auth**: All signature verification in one place (Fount)
3. **Automatic Rewards**: Every spell grants experience + nineum
4. **Gateway Rewards**: Gateway participants get 10% of rewards automatically distributed
5. **Reduced Code**: Addie handlers simplified without auth logic
6. **Consistent Pattern**: Same flow across all services

## Addie's Role in Planet Nine

Addie is the **payment processing service** that manages:

### Payment Processing
- Multi-processor support (Stripe, Square)
- Payment intent creation with and without splits
- Saved payment method management
- Charge processing

### Financial Distribution
- Gateway reward distribution for MAGIC protocol
- Percentage-based payment splitting
- Stripe Connect payouts
- Group-based payout management

### User Account Management
- Payment processor account creation
- Customer linking across processors
- Account deletion and cleanup

### Payment Method Management
- Save payment methods for future use
- List saved payment methods
- Delete payment methods
- Charge with saved methods

### Integration Points
- **Fount**: MP deduction and gateway identification
- **Stripe**: Primary payment processor
- **Square**: Secondary payment processor (in development)
- **Sanora**: E-commerce payment processing
- **Covenant**: Contract-based payments via signInMoney spell

## Special Spell: signInMoney

In addition to the standard MAGIC-routed endpoints, Addie also provides the `signInMoney` spell for contract-based payments:

**Purpose**: Process payment and sign contract step atomically

**Components**:
- `contractUuid`: UUID of the contract
- `stepId`: ID of the step to sign
- `amount`: Amount in cents
- `processor`: Payment processor
- `contractSignature`: Pre-signed signature for contract auth
- `stepSignature`: Pre-signed signature for step signing
- `pubKey`: Public key of the payer

**Flow**:
1. Process payment through Addie
2. Sign contract step via Covenant
3. Return combined result

This spell enables atomic payment + contract signing operations, crucial for lesson purchases and other contract-based transactions in the Planet Nine ecosystem.

## Next Steps

Progress on MAGIC route conversion:
- ✅ Joan (3 routes complete)
- ✅ Pref (4 routes complete)
- ✅ Aretha (4 routes complete)
- ✅ Continuebee (3 routes complete)
- ✅ BDO (4 routes complete)
- ✅ Julia (8 routes complete)
- ✅ Dolores (8 routes complete)
- ✅ Sanora (6 routes complete)
- ✅ Addie (9 routes complete)
- ⏳ Covenant
- ⏳ Prof
- ⏳ Fount (internal routes)
- ⏳ Minnie (SMTP only, no HTTP routes)

## Last Updated
January 14, 2025
