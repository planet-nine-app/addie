use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct AddieUser {
    #[serde(default)]
    pub pub_key: String,
    pub uuid: String,
    #[serde(rename = "stripeAccountId")]
    #[serde(default)]
    pub stripe_account_id: String
}

impl Default for AddieUser {
    fn default() -> Self {
        AddieUser {
            pub_key: "".to_string(),
            uuid: "".to_string(),
            stripe_account_id: "".to_string()
        }
    }
}

/// Response from the Express-account onboarding endpoint
/// (`/user/:uuid/processor/stripe/express`) — distinct from `AddieUser`
/// because this flow actually returns a hosted onboarding URL to redirect
/// the user to, which the plain/company `/processor/stripe` endpoint never
/// does. `stripe_onboarding_url` is absent when the server found an
/// already-connected account for this email (`already_connected: true`) and
/// skipped creating a fresh Account Link.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct AddieExpressAccount {
    #[serde(default)]
    pub pub_key: String,
    pub uuid: String,
    #[serde(rename = "stripeAccountId")]
    #[serde(default)]
    pub stripe_account_id: String,
    #[serde(rename = "stripeOnboardingUrl")]
    #[serde(default)]
    pub stripe_onboarding_url: Option<String>,
    #[serde(default)]
    pub already_connected: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Gateway {
    timestamp: String,
    uuid: String,
    minimum_cost: u32,
    ordinal: u64,
    signature: String,
    #[serde(flatten)]
    extra: HashMap<String, Value>
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Spell {
    pub timestamp: String,
    pub spell: String,
    #[serde(rename = "casterUUID")]
    pub caster_uuid: String,
    pub total_cost: u32, 
    pub mp: bool,
    pub ordinal: u32,
    pub caster_signature: String,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
    pub gateways: Vec<Gateway>
}

impl Default for Spell {
    fn default() -> Self {
	Spell {
	    timestamp: "now".to_string(),
	    spell: "test".to_string(),
	    caster_uuid: "".to_string(),
	    total_cost: 200,
	    mp: true,
	    ordinal: 1,
	    caster_signature: "".to_string(),
	    extra: HashMap::<String, Value>::new(),
	    gateways: Vec::<Gateway>::new()
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct SpellResult {
    pub success: bool,
    // arbitrary json somehow?
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SuccessResult {
    pub success: bool
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Nineum {
    pub nineum: Vec<String>
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct PaymentIntent {
    pub payment_intent: String,
    pub ephemeral_key: String,
    pub customer: String,
    #[serde(default)]
    pub publishable_key: Option<String>
}

impl PaymentIntent {
    pub fn new() -> Self {
        PaymentIntent {
            payment_intent: "".to_string(),
            ephemeral_key: "".to_string(),
            customer: "".to_string(),
            publishable_key: None
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Payee {
    pub pubKey: String,
    pub amount: i32
}

/// The recipient of the 91% split — Addie's buildPayeeMetadata caps this at
/// min(91% of gross, amount-after-Stripe-fee); only a pubKey is needed here,
/// the amount is computed server-side.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Merchant {
    pub pubKey: String
}

/// Response from `GET /saved-payment-methods` — each entry in
/// `payment_methods` is a raw Stripe PaymentMethod object (card
/// brand/last4/exp live at `.card.brand`/`.card.last4`/etc, plus a top-level
/// `.id` to pass back into `charge_with_saved_method`); left as `Value`
/// rather than a typed struct since addie-rs doesn't otherwise model
/// Stripe's own object shapes anywhere. Empty (not an error) when the buyer
/// has never saved a card yet.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct SavedPaymentMethods {
    #[serde(default)]
    pub payment_methods: Vec<Value>,
    #[serde(default)]
    pub customer_id: Option<String>,
}

/// Response from `POST /charge-with-saved-method`. On success,
/// `payment_intent` is the full Stripe PaymentIntent object. If Stripe
/// requires fresh 3DS authentication before this specific off-session
/// charge can complete (rare for an already-saved card, but possible),
/// `success` is `false`, `requires_authentication` is `true`, and
/// `payment_intent` is just `{id, client_secret}` — matches the server
/// route exactly (confirmed by reading addie.js/stripe.js).
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ChargeResult {
    pub success: bool,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub requires_authentication: bool,
    #[serde(default)]
    pub payment_intent: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct TransferResult {
    pub success: bool,
    #[serde(default)]
    pub transfers: Vec<Value>,
    #[serde(default)]
    pub payment_intent_id: Option<String>,
    #[serde(default)]
    pub total_transfers: Option<u32>,
    #[serde(default)]
    pub failed_transfers: Option<u32>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub message: Option<String>
}
