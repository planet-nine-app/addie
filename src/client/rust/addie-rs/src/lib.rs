pub mod structs;

#[cfg(test)]
mod tests;

use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sessionless::hex::IntoHex;
use sessionless::{Sessionless, Signature};
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use crate::structs::{AddieUser, AddieExpressAccount, Gateway, Nineum, Spell, SpellResult, SuccessResult, PaymentIntent, Payee, Merchant, TransferResult, SavedPaymentMethods, ChargeResult};

pub struct Addie {
    base_url: String,
    client: Client,
    pub sessionless: Sessionless,
}

impl Addie {
    pub fn new(base_url: Option<String>, sessionless: Option<Sessionless>) -> Self {
        Addie {
            base_url: base_url.unwrap_or("https://dev.addie.allyabase.com/".to_string()),
            client: Client::new(),
            sessionless: sessionless.unwrap_or(Sessionless::new()),
        }
    }

    async fn get(&self, url: &str) -> Result<Response, reqwest::Error> {
        self.client.get(url).send().await
    }

    async fn post(&self, url: &str, payload: serde_json::Value) -> Result<Response, reqwest::Error> {
        self.client
            .post(url)
            .json(&payload)
            .send()
            .await
    }

    async fn put(&self, url: &str, payload: serde_json::Value) -> Result<Response, reqwest::Error> {
        self.client
            .put(url)
            .json(&payload)
            .send()
            .await
    }

    async fn delete(&self, url: &str, payload: serde_json::Value) -> Result<Response, reqwest::Error> {
        self.client
            .delete(url)
            .json(&payload)
            .send()
            .await
    }

    /// Addie's error responses ({"error": ...}) don't share a shape with
    /// any success struct, so decoding straight into e.g. `AddieUser` fails
    /// with an opaque "error decoding response body" instead of surfacing
    /// what actually went wrong (a real Stripe error, an auth failure,
    /// etc). Parses as raw JSON first so a present `error` field can be
    /// turned into a real, readable `Err`.
    async fn parse_response<T: for<'de> serde::Deserialize<'de>>(res: Response) -> Result<T, Box<dyn std::error::Error>> {
        let value: serde_json::Value = res.json().await?;
        if let Some(error) = value.get("error") {
            if !error.is_null() {
                return Err(error.to_string().into());
            }
        }
        Ok(serde_json::from_value(value)?)
    }

    fn get_timestamp() -> String {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis()
            .to_string()
    }

    pub async fn create_user(&self) -> Result<AddieUser, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let pub_key = self.sessionless.public_key().to_hex();
        let signature = self.sessionless.sign(&format!("{}{}", timestamp, pub_key)).to_hex();
        
        let payload = json!({
            "timestamp": timestamp,
            "pubKey": pub_key,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/create", self.base_url);
        let res = self.put(&url, serde_json::Value::Object(payload)).await?;
        let user: AddieUser = res.json().await?;

        Ok(user)
    }

    pub async fn get_user_by_uuid(&self, uuid: &str) -> Result<AddieUser, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}", timestamp, uuid);
        let signature = self.sessionless.sign(&message).to_hex();

        let url = format!("{}user/{}?timestamp={}&signature={}", self.base_url, uuid, timestamp, signature);
        let res = self.get(&url).await?;
        let user: AddieUser = res.json().await?;

        Ok(user)
    }

    pub async fn add_processor_account(&self, uuid: &str, country: &str, name: &str, email: &str) -> Result<AddieUser, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        // Addie's route reads `country` from the body but does not include it
        // in the signed message (message = timestamp + uuid + name + email) —
        // matches the server route exactly, confirmed by reading addie.js.
        let message = format!("{}{}{}{}", timestamp, uuid, name, email);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "country": country,
            "name": name,
            "email": email,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/processor/stripe", self.base_url, uuid);
        let res = self.put(&url, serde_json::Value::Object(payload)).await?;

        Self::parse_response(res).await
    }

    /// The Express-account onboarding flow — unlike `add_processor_account`
    /// (a "Custom"-style company account meant for platform revenue splits,
    /// which never produces a hosted onboarding page), this creates a real
    /// Stripe Express account and a Stripe-hosted Account Link the caller
    /// must redirect the user to in a browser. `refresh_url` is where Stripe
    /// sends the user back if the link expires before they finish;
    /// `return_url` is where it sends them after they complete (or exit)
    /// onboarding — for a native app these are typically custom-scheme deep
    /// links back into the app, not web pages.
    pub async fn add_processor_express_account(
        &self,
        uuid: &str,
        country: &str,
        email: &str,
        refresh_url: &str,
        return_url: &str,
    ) -> Result<AddieExpressAccount, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        // Matches the server route exactly (confirmed by reading addie.js):
        // message = timestamp + uuid + email — country/refreshUrl/returnUrl
        // are read from the body but not part of the signed message.
        let message = format!("{}{}{}", timestamp, uuid, email);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "country": country,
            "email": email,
            "refreshUrl": refresh_url,
            "returnUrl": return_url,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/processor/stripe/express", self.base_url, uuid);
        let res = self.put(&url, serde_json::Value::Object(payload)).await?;

        Self::parse_response(res).await
    }

    pub async fn get_payment_intent(&self, uuid: &str, processor: &str, amount: &u32, currency: &str, payees: &Vec<Payee>, merchant: Option<&Merchant>) -> Result<PaymentIntent, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}{}", timestamp, uuid, amount, currency);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "amount": amount,
            "currency": currency,
            "payees": payees,
            "merchant": merchant,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/processor/{}/intent", self.base_url, uuid, processor);
        let res = self.post(&url, serde_json::Value::Object(payload)).await?;

        Self::parse_response(res).await
    }

    /// Same as `get_payment_intent`, but exposes the `savePaymentMethod`
    /// flag the server route already accepts (see
    /// `get_payment_intent_without_splits_saving`'s doc comment for why
    /// this is a new method rather than an added parameter — the existing
    /// `get_payment_intent` already has outside callers too).
    pub async fn get_payment_intent_saving(
        &self,
        uuid: &str,
        processor: &str,
        amount: &u32,
        currency: &str,
        payees: &Vec<Payee>,
        merchant: Option<&Merchant>,
        save_payment_method: bool,
    ) -> Result<PaymentIntent, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}{}", timestamp, uuid, amount, currency);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "amount": amount,
            "currency": currency,
            "payees": payees,
            "merchant": merchant,
            "savePaymentMethod": save_payment_method,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/processor/{}/intent", self.base_url, uuid, processor);
        let res = self.post(&url, serde_json::Value::Object(payload)).await?;

        Self::parse_response(res).await
    }

    /// Re-verifies the PaymentIntent actually succeeded directly with Stripe,
    /// then transfers each payee/merchant's cut — safe to call any time after
    /// the fact, since it never trusts a client-asserted "payment succeeded"
    /// claim. No signature required; matches the real, unauthenticated route.
    ///
    /// **Not** the same as `process_connected_transfers` below, despite the
    /// similar name/route — that one (`/process-connected-transfers`) only
    /// reads the `payees` array out of the PaymentIntent's metadata and
    /// completely ignores `merchant_pubkey`/`merchant_amount` (confirmed by
    /// reading `stripe-connected-transfers.js`), so a `Merchant` passed to
    /// `get_payment_intent`/`get_payment_intent_saving` would silently never
    /// actually get transferred anything through it. This method calls
    /// `/payment/:id/process-transfers` instead (the "payout card" route by
    /// name, but its implementation — `processPaymentTransfers` in
    /// stripe.js — handles both `merchant_pubkey`/`merchant_amount` *and*
    /// the `payees` array, falling back to a payout card destination only
    /// if a recipient has no Connected Account). This is the one to call
    /// for a `Merchant` split.
    pub async fn process_payment_transfers(&self, payment_intent_id: &str) -> Result<TransferResult, Box<dyn std::error::Error>> {
        let url = format!("{}payment/{}/process-transfers", self.base_url, payment_intent_id);
        let res = self.post(&url, serde_json::Value::Object(serde_json::Map::new())).await?;

        Self::parse_response(res).await
    }

    pub async fn process_connected_transfers(&self, payment_intent_id: &str) -> Result<TransferResult, Box<dyn std::error::Error>> {
        let url = format!("{}payment/{}/process-connected-transfers", self.base_url, payment_intent_id);
        let res = self.post(&url, serde_json::Value::Object(serde_json::Map::new())).await?;
        let result: TransferResult = res.json().await?;

        Ok(result)
    }

    pub async fn get_payment_intent_without_splits(&self, uuid: &str, processor: &str, amount: &u32, currency: &str) -> Result<PaymentIntent, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}{}", timestamp, uuid, amount, currency);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "amount": amount,
            "currency": currency,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/processor/{}/intent-without-splits", self.base_url, uuid, processor);
        let res = self.post(&url, serde_json::Value::Object(payload)).await?;
        let intent: PaymentIntent = res.json().await?;

        Ok(intent)
    }

    /// Same as `get_payment_intent_without_splits`, but exposes the
    /// `savePaymentMethod` flag the server route already accepts —
    /// passing `true` sets `setup_future_usage: 'off_session'` on the
    /// Stripe PaymentIntent server-side, which is what makes the card
    /// actually stick around on the customer for `charge_with_saved_method`
    /// to reuse later. A new method rather than adding a parameter to the
    /// existing one: `get_payment_intent_without_splits` already has
    /// callers across a dozen other apps in this ecosystem (ninefy,
    /// rhapsold, screenary, popups-please, magicsky, ...) — changing its
    /// signature would break all of them.
    pub async fn get_payment_intent_without_splits_saving(
        &self,
        uuid: &str,
        processor: &str,
        amount: &u32,
        currency: &str,
        save_payment_method: bool,
    ) -> Result<PaymentIntent, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        // Matches the server route exactly (confirmed by reading addie.js):
        // message = timestamp + uuid + amount + currency —
        // savePaymentMethod is read from the body but not part of the
        // signed message, same as the sibling method above.
        let message = format!("{}{}{}{}", timestamp, uuid, amount, currency);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "amount": amount,
            "currency": currency,
            "savePaymentMethod": save_payment_method,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/processor/{}/intent-without-splits", self.base_url, uuid, processor);
        let res = self.post(&url, serde_json::Value::Object(payload)).await?;

        Self::parse_response(res).await
    }

    /// Lists this buyer's saved (`allow_redisplay: 'always'`) payment
    /// methods — empty (not an error) if they've never saved one. Matches
    /// `GET /saved-payment-methods` exactly (confirmed by reading
    /// addie.js): auth is query-string based here, not a JSON body, since
    /// it's a GET.
    pub async fn get_saved_payment_methods(&self, uuid: &str, processor: &str) -> Result<SavedPaymentMethods, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}", timestamp, uuid);
        let signature = self.sessionless.sign(&message).to_hex();

        let url = format!(
            "{}saved-payment-methods?uuid={}&timestamp={}&processor={}&signature={}",
            self.base_url, uuid, timestamp, processor, signature
        );
        let res = self.get(&url).await?;

        Self::parse_response(res).await
    }

    /// Charges a previously-saved payment method off-session — no
    /// PaymentSheet / re-entering a card required. `requires_authentication`
    /// on the result means Stripe needs a fresh 3DS confirmation before
    /// this specific charge can go through (rare for an already-saved
    /// card, but possible); the caller should treat that as "ask the buyer
    /// to use a different card" rather than assume the charge will
    /// eventually succeed on its own.
    pub async fn charge_with_saved_method(
        &self,
        uuid: &str,
        amount: &u32,
        currency: &str,
        payment_method_id: &str,
        payees: &Vec<Payee>,
    ) -> Result<ChargeResult, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        // Matches the server route exactly (confirmed by reading addie.js):
        // message = timestamp + uuid + amount + paymentMethodId.
        let message = format!("{}{}{}{}", timestamp, uuid, amount, payment_method_id);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "uuid": uuid,
            "amount": amount,
            "currency": currency,
            "paymentMethodId": payment_method_id,
            "payees": payees,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}charge-with-saved-method", self.base_url);
        let res = self.post(&url, serde_json::Value::Object(payload)).await?;

        Self::parse_response(res).await
    }

    pub async fn delete_user(&self, uuid: &str) -> Result<SuccessResult, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}", timestamp, uuid);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
          "timestamp": timestamp,
          "uuid": uuid,
          "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}", self.base_url, uuid);
        let res = self.delete(&url, serde_json::Value::Object(payload)).await?;
        let success: SuccessResult = res.json().await?;

        Ok(success)
    }
}
