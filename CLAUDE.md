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
- `POST /payment/:paymentIntentId/process-transfers` - Process instant transfers to payout cards after payment

### Stripe Payout Cards (November 2025)
- `POST /payout-card/save` - Save debit card for receiving affiliate payouts
- `GET /payout-card/status` - Get payout card status

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

## Stripe Payout Cards Integration (November 2025)

### Overview

Addie provides direct debit card payout functionality for The Advancement iOS and Android apps, enabling users to receive instant affiliate commissions (30 minutes) without complex KYC onboarding. This replaces the previous Connected Accounts approach with a simpler, faster payout method.

### Architecture

```
┌────────────────────────────────────────────────────────┐
│  The Advancement App                                   │
│  - Selects debit card for payouts                      │
│  - Checks payout card status                           │
└───────────────────┬────────────────────────────────────┘
                    │ Sessionless Auth
                    ▼
┌────────────────────────────────────────────────────────┐
│  Addie Backend                                         │
│  /payout-card/save                                     │
│  /payout-card/status                                   │
│  /payment/:id/process-transfers                        │
└───────────────────┬────────────────────────────────────┘
                    │ Stripe API
                    ▼
┌────────────────────────────────────────────────────────┐
│  Stripe Platform                                       │
│  - Direct Debit Card Transfers                         │
│  - Instant Payouts (~30 minutes)                       │
│  - Works with Stripe Issued Cards                      │
└────────────────────────────────────────────────────────┘
```

### Endpoints

#### POST /payout-card/save

Saves a debit card payment method as the user's payout destination for receiving affiliate commissions.

**Request**:
```json
{
  "timestamp": "1234567890",
  "pubKey": "02a1b2c3...",
  "signature": "3045022100...",
  "paymentMethodId": "pm_1AbCdEfGhIjKlMn"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "payoutCardId": "pm_1AbCdEfGhIjKlMn",
  "last4": "4242",
  "brand": "visa",
  "expMonth": 12,
  "expYear": 2025
}
```

**Response (Error - Not Debit Card)**:
```json
{
  "success": false,
  "error": "Only debit cards can be used as payout destinations"
}
```

**Implementation** (`src/server/node/src/processors/stripe.js:681-717`):
- Validates payment method is a debit card (or issued card)
- Saves payment method ID to user record as `stripePayoutCardId`
- Returns card details for confirmation

**Signature**: `timestamp + pubKey + paymentMethodId`

#### GET /payout-card/status

Retrieves the user's current payout card status and details.

**Request (Query Parameters)**:
```
?timestamp=1234567890&pubKey=02a1b2c3...&signature=3045022100...
```

**Response (Has Payout Card)**:
```json
{
  "success": true,
  "hasPayoutCard": true,
  "payoutCardId": "pm_1AbCdEfGhIjKlMn",
  "last4": "4242",
  "brand": "visa",
  "expMonth": 12,
  "expYear": 2025
}
```

**Response (No Payout Card)**:
```json
{
  "success": true,
  "hasPayoutCard": false
}
```

**Implementation** (`src/server/node/src/processors/stripe.js:724-751`):
- Checks user record for `stripePayoutCardId`
- Fetches payment method details from Stripe if exists
- Returns card information

**Signature**: `timestamp + pubKey`

#### POST /payment/:paymentIntentId/process-transfers

Processes instant transfers to payout cards after payment confirmation.

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
      "destination": "pm_card_visa_debit"
    },
    {
      "pubKey": "02d4e5f6...",
      "amount": 4500,
      "transferId": "tr_2XyZaBcDeFgHiJk",
      "destination": "pm_card_mastercard_debit"
    }
  ],
  "paymentIntentId": "pi_1AbCdEfGhIjKlMn",
  "totalTransfers": 2,
  "failedTransfers": 0
}
```

**Implementation** (`src/server/node/src/processors/stripe.js:801-834`):
1. Retrieves payment intent by ID
2. Checks payment status is `succeeded`
3. Reads payee metadata from payment intent
4. Looks up each payee's saved payout card (`stripePayoutCardId`)
5. Creates direct Stripe transfers to debit cards (instant payout)
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
Bob saves payout card (debit card or issued card)
→ POST /payout-card/save with paymentMethodId
→ Instant setup, no KYC required
→ Can use external debit card or Planet Nine issued card

Carl saves payout card
→ Same process
→ Both can now receive instant payouts
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
→ Direct transfer $5 to Bob's payout card
→ Direct transfer $45 to Carl's payout card
→ Funds arrive in ~30 minutes (instant payout)
```

### Storage

Payout card IDs are stored in Addie user records:

```javascript
{
  uuid: "user-uuid",
  pubKey: "02a1b2c3...",
  stripeCustomerId: "cus_...",      // For making purchases
  stripePayoutCardId: "pm_...",     // For receiving payouts (debit card)
  stripeCardholderId: "ich_..."     // For virtual cards
}
```

### Testing

Comprehensive integration tests available in Sharon:

```bash
cd sharon
npm run test:the-advancement
```

**Test Coverage**:
- ✅ Check payout card status
- ✅ Save debit cards as payout destinations
- ✅ Validate debit-only restriction
- ✅ Create payment intents with splits
- ✅ Process instant transfers to payout cards
- ✅ Handle missing payout cards gracefully

See `/sharon/tests/the-advancement/README.md` for complete documentation.

### Integration with The Advancement App

The Advancement iOS and Android apps use these endpoints for:

**iOS** (`PaymentMethodViewController.swift`):
- `savePayoutCard()` - Saves debit card for payouts
- `getPayoutCardStatus()` - Checks payout card status

**Android** (`PaymentMethodActivity.kt`):
- Same two methods with Kotlin coroutines
- SharedPreferences for payout card ID storage

Both apps provide a "Receive Payments" tab with two-state UI:
1. **Not Setup**: List of available debit cards with "Use for Payouts" buttons
2. **Setup**: Payout card details with instant payout messaging

### Security

- **Sessionless Authentication**: All requests require cryptographic signatures
- **Card Ownership**: Payout card IDs linked to user's public key
- **Debit-Only Validation**: Only debit cards accepted as payout destinations
- **Transfer Validation**: Only transfers to verified payout cards
- **Metadata Security**: Payee data stored in payment intent metadata

### Benefits over Connected Accounts

1. **Instant Setup**: No KYC onboarding required
2. **Faster Payouts**: ~30 minutes vs 2-3 business days
3. **Works with Issued Cards**: Planet Nine virtual cards can receive payouts
4. **Simpler UX**: 2-state UI vs 3-state (not setup/pending/active)
5. **Lower Barrier**: Unbanked users with issued cards can receive payouts immediately

### Trade-offs

- **Higher Fees**: 1.5% per payout vs 0.25% for Connected Accounts
- **US-Only**: Direct debit card transfers only work in the US (acceptable for beta)

## Product Metadata in Stripe Dashboard (November 2025)

### Overview

All payment intents and transfers now include product metadata that appears in the Stripe Dashboard, making it easy to identify which products generated revenue and track affiliate commissions.

### What Shows Up in Stripe

**Payment Intent**:
- **Description** (most visible): "Purchase: Advanced React Course (with affiliate commission)"
- **Metadata**:
  - `product_name`: "Advanced React Course"
  - `product_id`: "prod_abc123" (optional)
  - `contract_uuid`: "uuid-..." (optional)
  - `emojicode`: "🌍🔑💎🌟💎🎨🐉📌" (optional)
  - `payee_count`: "2"
  - `payee_0_pubkey`: "02a1b2c3..."
  - `payee_0_amount`: "500"
  - `payee_1_pubkey`: "02d4e5f6..."
  - `payee_1_amount`: "4500"

**Transfer** (to payout cards):
- **Description**: "Advanced React Course - Affiliate payout"
- **Metadata**:
  - `product_name`: "Advanced React Course"
  - `commission_type`: "affiliate" or "creator"
  - `payee_pubkey`: "02a1b2c3..." (truncated to 20 chars)
  - `original_payment_intent`: "pi_abc123"
  - `product_id`: "prod_abc123" (if provided)
  - `contract_uuid`: "uuid-..." (if provided)
  - `emojicode`: "🌍🔑💎..." (if provided)

### API Usage

When creating a payment intent, include product information in the request body:

```javascript
POST /user/:uuid/processor/stripe/intent

{
  "timestamp": "1234567890",
  "amount": 5000,
  "currency": "usd",
  "payees": [
    { "pubKey": "02a1b2c3...", "amount": 500 },   // Affiliate
    { "pubKey": "02d4e5f6...", "amount": 4500 }   // Creator
  ],
  "signature": "...",

  // Product metadata (all optional)
  "productName": "Advanced React Course",
  "productId": "prod_abc123",
  "contractUuid": "uuid-...",
  "emojicode": "🌍🔑💎🌟💎🎨🐉📌"
}
```

### Implementation Details

**stripe.js** (`getStripePaymentIntent` function):
```javascript
// Accepts optional productInfo parameter
getStripePaymentIntent: async (foundUser, amount, currency, payees, savePaymentMethod = false, productInfo = {}) => {
  // Build description for dashboard
  let description = 'Product purchase';
  if(productInfo.productName) {
    description = `Purchase: ${productInfo.productName}`;
    if(payeeMetadata.payee_count > 1) {
      description += ' (with affiliate commission)';
    }
  }

  // Add product fields to metadata
  if(productInfo.productName) payeeMetadata.product_name = productInfo.productName;
  if(productInfo.productId) payeeMetadata.product_id = productInfo.productId;
  if(productInfo.contractUuid) payeeMetadata.contract_uuid = productInfo.contractUuid;
  if(productInfo.emojicode) payeeMetadata.emojicode = productInfo.emojicode;

  // Create payment intent with description + metadata
  const paymentIntent = await stripeSDK.paymentIntents.create({
    description: description, // Shows prominently in dashboard
    metadata: payeeMetadata,
    // ... other fields
  });
}
```

**Transfer Creation** (`processPaymentTransfers` function):
```javascript
// Read product info from payment intent metadata
const productName = metadata.product_name || 'Product';
const commissionType = i === 0 ? 'Affiliate' : 'Creator';

// Create descriptive transfer
const transfer = await stripeSDK.transfers.create({
  description: `${productName} - ${commissionType} payout`,
  metadata: {
    product_name: metadata.product_name,
    commission_type: commissionType.toLowerCase(),
    payee_pubkey: pubKey.substring(0, 20),
    original_payment_intent: paymentIntentId,
    // Optional fields copied from payment intent
    product_id: metadata.product_id,
    contract_uuid: metadata.contract_uuid,
    emojicode: metadata.emojicode
  }
});
```

### Benefits

1. **Easy Reconciliation**: See exactly which product generated each payment
2. **Debugging**: Trace payments from purchase → transfers using metadata
3. **Reporting**: Filter Stripe Dashboard by product name or ID
4. **Transparency**: Clear descriptions for all parties involved
5. **Contract Linking**: Connect payments to Covenant contracts via UUID

### Example Dashboard Flow

1. **Payment List**: "Purchase: Advanced React Course (with affiliate commission)"
2. **Click Payment**: See full metadata with product details and payee split
3. **View Transfers**: Two transfers show:
   - "Advanced React Course - Affiliate payout" ($5)
   - "Advanced React Course - Creator payout" ($45)
4. **Search**: Search for "Advanced React Course" to see all related transactions

## Last Updated
November 1, 2025 - Added product metadata to payment intents and transfers for Stripe Dashboard visibility. Converted from Stripe Connected Accounts to direct debit card payouts for instant affiliate commissions. All endpoints tested via Sharon test suite. Ready for production deployment.
