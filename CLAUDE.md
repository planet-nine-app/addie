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

### User Management
- `PUT /user/create` - Create or get Addie user by public key
- `GET /user/:uuid` - Get user by UUID (requires authentication)
- `GET /user/lookup/:uuid` - Lookup user by UUID for base admin (no auth required)

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

## Base Payout System (January 2025)

The base payout system enables Planet Nine bases to receive payments for hosting services and pay out users for contributing to the base.

### User Flow

1. **User displays service identifiers** in The Advancement app:
   - Navigate to Payment Setup → Service Info
   - View Fount UUID, Covenant UUID, Addie UUID, and Public Key
   - Tap any value to copy to clipboard

2. **User shares UUIDs** with base administrator:
   - Send UUIDs via secure channel
   - Administrator can use any of the three service UUIDs (Fount, Covenant, or Addie)

3. **Base administrator looks up user**:
   - Use `GET /user/lookup/:uuid` endpoint
   - No authentication required (public lookup)
   - Returns minimal info: UUID, pubKey, payout card status

4. **Administrator configures payouts**:
   - Verify user has payout card configured (`canReceivePayouts: true`)
   - Add user to base payout recipients list
   - Configure payout percentages or amounts

### Lookup Endpoint

**Endpoint**: `GET /user/lookup/:uuid`

**No authentication required** - This endpoint is intentionally public to allow base administrators to lookup users by their service UUIDs.

**Request**:
```bash
curl http://localhost:3005/user/lookup/fount-uuid-here
# or
curl http://localhost:3005/user/lookup/addie-uuid-here
```

**Response**:
```javascript
{
  uuid: "addie-user-uuid",
  pubKey: "02a1b2c3...",
  stripeCustomerId: "cus_...",
  stripePayoutCardId: "pm_...",
  canReceivePayouts: true
}
```

**Security Considerations**:
- Returns only minimal information needed for payout setup
- Does not expose sensitive payment details
- Payout card ID is not sufficient to perform unauthorized transactions
- Actual payouts still require proper authentication and authorization

## Security Model

- **Sessionless Authentication**: All operations require cryptographic signatures
- **No Stored Credentials**: Payment processor credentials managed securely
- **Transaction Verification**: All payments verified before contract signing
- **Public Lookup**: User lookup endpoint intentionally public for base admin convenience

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
January 2025 - Added base payout system with public user lookup endpoint (`GET /user/lookup/:uuid`) and Service Info UI in The Advancement app for sharing service UUIDs with base administrators.
