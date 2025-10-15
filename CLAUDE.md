# Addie - Payment Processing Service

## Overview

Addie is a Planet Nine allyabase microservice that handles payment processing and financial transactions.

**Location**: `/addie/`
**Port**: 3004 (default)

## Core Features

### 💳 **Payment Processing**
- **Multiple Processors**: Supports various payment processors (Stripe, simulated, etc.)
- **Sessionless Authentication**: All transactions require cryptographic signatures
- **Transaction Tracking**: Complete audit trail of all payment operations

## API Endpoints

### Payment Operations
- `POST /payment` - Process a payment transaction

### MAGIC Protocol
- `POST /magic/spell/:spellName` - Execute MAGIC spells for payment operations

### Health & Status
- `GET /health` - Service health check (if available)

## MAGIC Protocol Integration

### Available Spells

#### `signInMoney`
Processes a payment and signs a Covenant contract step to record the transaction.

**Spell Components**:
- `contractUuid` - UUID of the contract to sign
- `stepId` - ID of the contract step (typically the first step: "Payment Completed")
- `amount` - Payment amount in cents
- `processor` - Payment processor name (e.g., 'stripe', 'simulated')
- `paymentDetails` - Processor-specific payment details (optional)
- `pubKey` - Public key of the payer
- `contractSignature` - Pre-signed signature for contract authentication (message: `timestamp + userUUID + contractUUID`)
- `stepSignature` - Pre-signed signature for step signing (message: `timestamp + userUUID + contractUUID + stepId`)

**Process**:
1. Validates required spell components
2. Processes payment through the specified processor
3. Signs the specified contract step via Covenant's `/contract/:uuid/sign` endpoint using pre-signed signatures
4. Returns payment and signing results

**Returns**:
```javascript
{
  success: true,
  payment: {
    success: true,
    transactionId: "txn_...",
    amount: 1999,
    processor: "simulated"
  },
  contractSign: { /* Covenant sign response */ }
}
```

**Error Response**:
```javascript
{
  success: false,
  error: "Error description"
}
```

**Important Notes**:
- Currently uses simulated payment processing (TODO: integrate real processors)
- Requires valid spell caster signature for authentication
- **Critical**: Spell resolvers don't have access to private keys, so spell casters must pre-sign BOTH signatures:
  - `contractSignature` for Covenant endpoint authentication
  - `stepSignature` for the actual contract step signing
- Works in conjunction with Covenant's purchaseLesson spell for lesson purchases

### Other Spells

#### `joinup`
Registers a user with Addie's payment system.

#### `linkup`
Links a user's payment account with external services.

### Implementation Details

The MAGIC endpoint (`/magic/spell/:spellName`) allows other services to trigger payment operations through the spell protocol. All payment operations require proper sessionless authentication.

**Location**: `/src/server/node/src/magic/magic.js`

## Integration Patterns

### Lesson Purchase Flow
1. Student casts `purchaseLesson` spell to Covenant
2. Covenant creates SODOTO contract
3. Student casts `signInMoney` spell to Addie
4. Addie processes payment and signs contract step
5. Contract progresses through remaining steps

## Security Model

- **Sessionless Authentication**: All operations require cryptographic signatures
- **No Stored Credentials**: Payment processor credentials managed securely
- **Transaction Verification**: All payments verified before contract signing

## Future Enhancements

### Payment Features
- **Real Payment Processors**: Full Stripe integration
- **Multi-Currency Support**: Handle various currencies
- **Refund Processing**: Automated refund workflows
- **Subscription Management**: Recurring payment handling

### MAGIC Features
- **Automated Refunds**: Spell-based refund processing
- **Payment Verification**: Multi-step payment confirmation
- **Escrow Services**: Hold payments until contract completion

## MAGIC Route Conversion (October 2025)

All Addie REST endpoints have been converted to MAGIC protocol spells:

### Converted Spells (7 total)
1. **addieUserCreate** - Create payment processing user
2. **addieUserProcessor** - Set up payment processor for user
3. **addieUserProcessorIntentWithoutSplits** - Create payment intent without revenue splits
4. **addieChargeSavedMethod** - Charge a saved payment method
5. **addiePaymentMethodsIntent** - Get saved payment methods and create intent
6. **addieSavedPaymentMethodDelete** - Delete saved payment method
7. **addieMoneyProcessor** - Process money through payment processor

**Testing**: Comprehensive MAGIC spell tests available in `/test/mocha/magic-spells.js` (10 tests covering success and error cases)

**Documentation**: See `/MAGIC-ROUTES.md` for complete spell specifications and migration guide

## Last Updated
October 14, 2025 - Completed full MAGIC protocol conversion. All 7 routes now accessible via MAGIC spells with centralized Fount authentication.
