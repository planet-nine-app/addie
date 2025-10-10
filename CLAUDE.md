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

**Process**:
1. Validates required spell components
2. Processes payment through the specified processor
3. Signs the specified contract step via Covenant's `/contract/:uuid/sign` endpoint
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
- The contract step is signed using the spell's casterSignature
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

## Last Updated
October 8, 2025 - Added MAGIC protocol integration with signInMoney spell for contract-based payments.
