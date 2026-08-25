# Stripe Payee Registration

## Overview

This directory contains the Stripe payee registration form that allows users to create a Stripe Connect account and register as a payee in the Planet Nine payment splitting system.

## Files

- `stripe-registration.html` - Registration form for creating Stripe accounts and payee records

## Accessing the Form

Once Addie is running, access the form at:

```
http://localhost:3005/stripe-registration.html
```

Or in production:

```
https://[subdomain].addie.allyabase.com/stripe-registration.html
```

## What the Form Does

1. **Generates Cryptographic Keys**: Creates a sessionless keypair for the user
2. **Creates Addie User**: Registers the user with Addie's payment system
3. **Creates Stripe Account**: Sets up a Stripe Connect account using `putStripeAccount`
4. **Creates Payee BDO**: Stores a public BDO containing the payee 4-tuple:
   - `pubKey` - Payee's public key
   - `amount` - Base amount (defaults to 0, overridden per transaction)
   - `addieURL` - The Addie instance URL (for federated payments)
   - `signature` - Cryptographic signature for authentication
5. **Makes BDO Public**: Generates an emojicode for the payee record
6. **Displays Results**: Shows the BDO public key and instructions to email it to zach@planetnine.app

## Payee 4-Tuple Structure

The payee record stored in the BDO follows this structure:

```javascript
{
  pubKey: "02a1b2c3...",           // Payee's public key
  amount: 0,                        // Base amount in cents (0 = percentage-based)
  addieURL: "http://localhost:3005", // Addie instance for this payee
  signature: "3045..."             // Signature of pubKey + addieURL
}
```

This 4-tuple enables:
- **Federated Payments**: Different payees can use different Addie instances
- **Authentication**: Signatures prove ownership of the payee record
- **Flexible Splits**: Amounts can be set per-transaction or use base amounts

## Integration with Payment Splits

When processing payments with splits, the system:

1. Fetches the payee BDO by its public key (emojicode)
2. Extracts the 4-tuple (pubKey, amount, addieURL, signature)
3. Verifies the signature
4. Looks up the Stripe account using `pubKey` via the specified `addieURL`
5. Creates a Stripe transfer to that account

This allows payment splits across multiple Addie instances in a federated architecture.

## Security Notes

- **Private Key Storage**: Users must securely store their private key
- **Public BDOs**: Payee records are public by design (emojicodes enable discovery)
- **Signature Verification**: All payment operations verify signatures
- **Stripe Connect**: Uses Stripe's secure connected account system

## Email Instructions

After registration, users can click the **"📧 Send Registration Email"** button which:
- Opens their default email client
- Pre-fills the recipient: zach@planetnine.app
- Pre-fills the subject: "Payee Registration"
- Pre-fills the body with all registration details:
  - BDO Public Key (UUID)
  - Emojicode
  - Name, email, country
  - Public Key
  - Addie UUID
  - Stripe Account ID
  - Addie URL

Users just need to click the button and press Send in their email client!

## Development

To test locally:

```bash
# Start Addie (requires BDO and Fount running)
cd /path/to/addie/src/server/node
node addie.js

# Visit the form
open http://localhost:3005/stripe-registration.html
```

## Stripe Requirements

The country selected must be supported by Stripe Connect. Currently supported countries include:
- United States (US)
- Canada (CA)
- United Kingdom (GB)
- Australia (AU)
- Germany (DE)
- France (FR)
- And 13 others (see form dropdown)

For the complete list of supported countries, see [Stripe's documentation](https://stripe.com/docs/connect/accounts).

## Future Enhancements

- **Percentage-Based Splits**: Add UI for setting default percentages
- **Multiple Payment Processors**: Support beyond Stripe
- **Payee Dashboard**: View earnings and transaction history
- ~~**Auto-Email**: Submit BDO key directly to admin API~~ - **DONE** (mailto: link)
