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
- `POST /payment/:paymentIntentId/process-transfers` - Process transfers to Connected Accounts after payment

### Stripe Connected Accounts (October 2025)
- `POST /processor/stripe/create-account` - Create Stripe Express Connected Account
- `GET /processor/stripe/account/status` - Get Connected Account status
- `POST /processor/stripe/account/refresh-link` - Refresh onboarding link

### Stripe Payment Methods
- `POST /processor/stripe/setup-intent` - Create SetupIntent for saving cards
- `GET /processor/stripe/payment-methods` - Get saved payment methods
- `DELETE /processor/stripe/payment-method/:id` - Delete saved payment method

### Stripe Payment Intents
- `POST /processor/stripe/payment-intent` - Create payment intent with affiliate splits
- `POST /processor/stripe/payment-intent-without-splits` - Create simple payment intent

### Stripe Issuing (Virtual Cards for the Unbanked)
- `POST /processor/stripe/cardholder` - Create Stripe Issuing cardholder
- `POST /processor/stripe/issue-virtual-card` - Issue virtual debit card
- `GET /processor/stripe/issued-cards` - Get user's issued cards
- `GET /processor/stripe/transactions` - Get card transactions
- `PUT /processor/stripe/card/:id/status` - Update card status (freeze/unfreeze/cancel)

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

## Stripe Connected Accounts Integration (October 2025)

### Overview

Addie provides complete Stripe Connected Account management for The Advancement iOS and Android apps, enabling users to receive affiliate commissions and product sales revenue. This is critical for the affiliate marketplace flow where sellers need to receive payments.

### Architecture

```
┌────────────────────────────────────────────────────────┐
│  The Advancement App                                   │
│  - Creates connected account                           │
│  - Checks account status                               │
│  - Refreshes onboarding links                          │
└───────────────────┬────────────────────────────────────┘
                    │ Sessionless Auth
                    ▼
┌────────────────────────────────────────────────────────┐
│  Addie Backend                                         │
│  /processor/stripe/create-account                      │
│  /processor/stripe/account/status                      │
│  /processor/stripe/account/refresh-link                │
│  /payment/:id/process-transfers                        │
└───────────────────┬────────────────────────────────────┘
                    │ Stripe API
                    ▼
┌────────────────────────────────────────────────────────┐
│  Stripe Platform                                       │
│  - Express Connected Accounts                          │
│  - Onboarding flows                                    │
│  - Transfer capabilities                               │
└────────────────────────────────────────────────────────┘
```

### Endpoints

#### POST /processor/stripe/create-account

Creates a Stripe Express Connected Account for receiving payments.

**Request**:
```json
{
  "timestamp": "1234567890",
  "pubKey": "02a1b2c3...",
  "signature": "3045022100...",
  "accountType": "express",
  "country": "US",
  "email": "user@example.com",
  "businessType": "individual"
}
```

**Response**:
```json
{
  "accountId": "acct_1AbCdEfGhIjKlMn",
  "accountLink": "https://connect.stripe.com/setup/s/abc123..."
}
```

**Implementation** (`src/server/node/src/processors/stripe.js`):
- Creates Stripe Express account with transfer capabilities
- Generates account link for onboarding
- Stores accountId in Addie user record
- Returns onboarding URL for KYC completion

#### GET /processor/stripe/account/status

Retrieves the status of a user's Connected Account.

**Request Headers**:
```
X-Timestamp: 1234567890
X-PublicKey: 02a1b2c3...
X-Signature: 3045022100...
```

**Response**:
```json
{
  "hasAccount": true,
  "accountId": "acct_1AbCdEfGhIjKlMn",
  "detailsSubmitted": true,
  "chargesEnabled": true,
  "payoutsEnabled": true
}
```

**Implementation**:
- Retrieves accountId from user record
- Fetches account details from Stripe
- Returns onboarding and capability status

#### POST /processor/stripe/account/refresh-link

Generates a fresh onboarding link for an existing account.

**Request**:
```json
{
  "timestamp": "1234567890",
  "pubKey": "02a1b2c3...",
  "signature": "3045022100..."
}
```

**Response**:
```json
{
  "accountLink": "https://connect.stripe.com/setup/s/xyz789..."
}
```

**Implementation**:
- Uses stored accountId from user record
- Creates new account link with Stripe
- Returns fresh onboarding URL

#### POST /payment/:paymentIntentId/process-transfers

Processes transfers to Connected Accounts after payment confirmation.

**Request**:
```json
{
  "timestamp": "1234567890",
  "pubKey": "02a1b2c3...",
  "signature": "3045022100..."
}
```

**Response**:
```json
{
  "success": true,
  "transfers": [
    {
      "pubKey": "02a1b2c3...",
      "amount": 500,
      "transferId": "tr_1AbCdEfGhIjKlMn",
      "destination": "acct_affiliate"
    },
    {
      "pubKey": "02d4e5f6...",
      "amount": 4500,
      "transferId": "tr_2XyZaBcDeFgHiJk",
      "destination": "acct_creator"
    }
  ],
  "paymentIntentId": "pi_1AbCdEfGhIjKlMn",
  "totalTransfers": 2,
  "failedTransfers": 0
}
```

**Implementation** (`src/server/node/src/processors/stripe.js:680-774`):
1. Retrieves payment intent by ID
2. Checks payment status is `succeeded`
3. Reads payee metadata from payment intent
4. Looks up each payee's Connected Account
5. Creates Stripe transfers to each account
6. Returns transfer results

**Metadata Format** (stored in payment intent):
```json
{
  "payee_count": "2",
  "payee_0_pubkey": "02a1b2c3...",
  "payee_0_amount": "500",
  "payee_1_pubkey": "02d4e5f6...",
  "payee_1_amount": "4500"
}
```

### Affiliate Commission Flow

**Complete Alice → Bob → Carl Flow**:

1. **Setup Phase**:
```
Bob creates Connected Account
→ POST /processor/stripe/create-account
→ Bob completes Stripe onboarding (KYC)
→ detailsSubmitted: true, payoutsEnabled: true

Carl creates Connected Account
→ Same process
→ Both can now receive payments
```

2. **Purchase Phase**:
```
Carl creates $50 product
→ Bob duplicates with 10% affiliate commission
→ Alice purchases via Bob's link

Payment intent created with metadata:
{
  "payee_count": "2",
  "payee_0_pubkey": "<Bob's pubKey>",
  "payee_0_amount": "500",      // $5 (10% commission)
  "payee_1_pubkey": "<Carl's pubKey>",
  "payee_1_amount": "4500"      // $45 (90% revenue)
}
```

3. **Transfer Phase**:
```
Alice confirms payment via Stripe
→ Payment status: succeeded
→ POST /payment/pi_xxx/process-transfers
→ Transfer $5 to Bob's Connected Account
→ Transfer $45 to Carl's Connected Account
→ Funds arrive in 2-3 business days
```

### Storage

Connected Account IDs are stored in Addie user records:

```javascript
{
  uuid: "user-uuid",
  pubKey: "02a1b2c3...",
  stripeCustomerId: "cus_...",     // For making purchases
  stripeAccountId: "acct_...",     // For receiving payments
  stripeCardholderId: "ich_..."    // For virtual cards
}
```

### Testing

Comprehensive integration tests available in Sharon:

```bash
cd sharon
npm run test:the-advancement
```

**Test Coverage**:
- ✅ Create Connected Accounts (Express accounts)
- ✅ Generate onboarding links
- ✅ Check account status
- ✅ Refresh onboarding links
- ✅ Create payment intents with splits
- ✅ Process transfers to Connected Accounts
- ✅ Handle missing/invalid accounts gracefully

See `/sharon/tests/the-advancement/README.md` for complete documentation.

### Integration with The Advancement App

The Advancement iOS and Android apps use these endpoints for:

**iOS** (`PaymentMethodViewController.swift`):
- `createConnectedAccount()` - Creates Express account
- `getConnectedAccountStatus()` - Checks account status
- `refreshAccountLink()` - Refreshes onboarding

**Android** (`PaymentMethodActivity.kt`):
- Same three methods with Kotlin coroutines
- SharedPreferences for account ID storage

Both apps provide a "Receive Payments" tab with three-state UI:
1. **Not Setup**: Button to create account
2. **Pending**: Button to continue onboarding
3. **Active**: Account details with status indicators

### Security

- **Sessionless Authentication**: All requests require cryptographic signatures
- **Account Ownership**: Account IDs linked to user's public key
- **Transfer Validation**: Only transfers to verified Connected Accounts
- **Metadata Security**: Payee data encrypted in payment intent metadata

## Last Updated
October 31, 2025 - Added complete Stripe Connected Accounts integration with transfer processing for affiliate marketplace. All endpoints tested via Sharon test suite. Ready for production deployment.
