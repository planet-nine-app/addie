# Stripe Payee Registration System

## Overview

A complete self-service registration system for users to create Stripe Connect accounts and register as payees in the Planet Nine payment splitting system.

## What Was Created

### 1. Public Directory
- **Location**: `/allyabase/deployment/addie/public/`
- **Purpose**: Serve static HTML files for user-facing interfaces

### 2. Registration Form
- **File**: `public/stripe-registration.html`
- **URL**: `http://localhost:3005/stripe-registration.html` (when running)

### 3. Static File Serving
- **Updated**: `src/server/node/addie.js`
- **Added**: `app.use(express.static('public'))`

## Payee 4-Tuple Structure

The system creates a BDO with the following structure for payment splits:

```javascript
{
  pubKey: "02a1b2c3d4e5f6...",      // Payee's public key
  amount: 0,                         // Amount in cents (0 = flexible per-transaction)
  addieURL: "http://localhost:3005", // Addie instance URL (for federation)
  signature: "304502..."             // Signature of (pubKey + addieURL)
}
```

### Property Names (Verified Against stripe.js)

Based on `/src/processors/stripe.js` lines 100-106, the payee structure uses:
- ✅ `pubKey` - Looked up via `user.getUserByPublicKey(payee.pubKey)`
- ✅ `amount` - Used as `payee.amount` in transfers

Additional properties for federation:
- ✅ `addieURL` - Enables federated payment splits across different Addie instances
- ✅ `signature` - Authenticates the payee record

## Registration Flow

1. **User visits form** at `http://localhost:3005/stripe-registration.html`

2. **User enters information**:
   - Country (Stripe-supported countries only)
   - Full name
   - Email address

3. **System automatically**:
   - Generates a sessionless keypair
   - Creates Addie user account
   - Creates Stripe Connect account via `putStripeAccount` (line 32 of stripe.js)
   - Creates BDO user in payee-registry hash
   - Creates public BDO with 4-tuple
   - Generates emojicode for the BDO

4. **User receives**:
   - BDO Public Key (UUID) - **Send this to zach@planetnine.app**
   - Emojicode
   - Public Key
   - Addie UUID
   - Stripe Account ID
   - Private Key (must save securely!)

5. **User clicks "Send Registration Email"** button:
   - Opens their default email client
   - Email is pre-filled with all registration details
   - User just needs to press Send!

## Usage in Payment Splits

When processing payments with multiple payees:

```javascript
// Example payee array for stripe.getStripePaymentIntent()
const payees = [
  {
    pubKey: "02abc...",  // From payee BDO
    amount: 1000         // $10.00 in cents
  },
  {
    pubKey: "02def...",  // Another payee
    amount: 500          // $5.00 in cents
  }
];

// System looks up each pubKey to find stripeAccountId
const account = (await user.getUserByPublicKey(payee.pubKey)).stripeAccountId;

// Then creates transfers
await stripeSDK.transfers.create({
  amount: payee.amount,
  currency: 'usd',
  destination: account,
  transfer_group: groupName
});
```

## Federation Support

The 4-tuple enables federated payment splits:

1. **Different Addie Instances**: Each payee can use a different Addie service
2. **Cross-Base Payments**: Base A can pay users from Base B and Base C
3. **Signature Verification**: Ensures payee records are authentic
4. **Flexible Routing**: `addieURL` tells the system where to look up the payee

## Security Features

- **Sessionless Authentication**: All operations require cryptographic signatures
- **Public BDOs**: Payee records are intentionally public (discoverable via emojicode)
- **Stripe Connect**: Uses Stripe's secure connected account system
- **Signature Verification**: Each payee record includes a signature for authenticity

## Testing

### Start Services

```bash
# Terminal 1: Start BDO (required)
cd /path/to/bdo
node src/server/node/bdo.js

# Terminal 2: Start Fount (required)
cd /path/to/fount
node src/server/node/fount.js

# Terminal 3: Start Addie
cd /path/to/addie/src/server/node
node addie.js
```

### Access Form

```bash
# Open in browser
open http://localhost:3005/stripe-registration.html

# Or with curl
curl http://localhost:3005/stripe-registration.html
```

### Test Registration

1. Visit `http://localhost:3005/stripe-registration.html`
2. Fill out the form with test data
3. Submit and wait for BDO creation
4. Copy the BDO Public Key
5. Email it to zach@planetnine.app

## Next Steps

After registration is complete:

1. **Admin receives email** with BDO Public Key
2. **Admin adds to payee registry** (implementation TBD)
3. **Payee is available** for payment splits
4. **Transactions can include** this payee in split arrays

## Files Changed/Created

```
addie/
├── public/                                    # NEW
│   ├── stripe-registration.html              # NEW - Registration form
│   └── README.md                              # NEW - Documentation
├── src/server/node/
│   └── addie.js                               # MODIFIED - Added static file serving
└── STRIPE-REGISTRATION.md                     # NEW - This file
```

## Related Code

- **Stripe Processor**: `/src/server/node/src/processors/stripe.js`
  - Line 32: `putStripeAccount()` method
  - Lines 100-106: Payee structure usage
- **User Management**: `/src/server/node/src/user/user.js`
  - `getUserByPublicKey()` method
- **BDO Integration**: Uses `bdo-js` SDK for storage
- **Sessionless Auth**: Uses `sessionless-node` for signatures

## Dependencies

Already installed in Addie:
- ✅ `express` - Web server
- ✅ `bdo-js` - BDO storage
- ✅ `sessionless-node` - Authentication
- ✅ `stripe` - Payment processing

Client-side (CDN):
- `sessionless@0.10.0` - Key generation and signing
- `bdo-js@1.0.59` - BDO operations

## Future Enhancements

- [x] ~~Auto-email BDO key to admin via API~~ - **DONE** (mailto: link with pre-filled data)
- [ ] Dashboard for viewing registration status
- [ ] Support for percentage-based splits
- [ ] Multiple payment processor support
- [ ] Payee earnings dashboard
- [ ] Transaction history viewer
- [ ] Server-side email sending (via Minnie or SendGrid)
