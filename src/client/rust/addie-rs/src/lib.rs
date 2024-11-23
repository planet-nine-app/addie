mod structs;

#[cfg(test)]
mod tests;

use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sessionless::hex::IntoHex;
use sessionless::{Sessionless, Signature};
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use crate::structs::{AddieUser, Gateway, Nineum, Spell, SpellResult, SuccessResult, PaymentIntent};

pub struct Addie {
    base_url: String,
    client: Client,
    pub sessionless: Sessionless,
}

impl Addie {
    pub fn new(base_url: Option<String>) -> Self {
        Addie {
            base_url: base_url.unwrap_or("https://dev.addie.allyabase.com/".to_string()),
            client: Client::new(),
            sessionless: Sessionless::new(),
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

    pub async fn add_processor_account(&self, uuid: &str, name: &str, email: &str) -> Result<AddieUser, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}{}", timestamp, uuid, name, email);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "name": name,
            "email": email,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/processor/stripe", self.base_url, uuid);
        let res = self.put(&url, serde_json::Value::Object(payload)).await?;
        let user: AddieUser = res.json().await?;

        Ok(user)
    }

    pub async fn get_payment_intent(&self, uuid: &str, processor: &str, amount: &u32, currency: &str, payees: &Vec<String>) -> Result<PaymentIntent, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}{}", timestamp, uuid, amount, currency);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "amount": amount,
            "currency": currency,
            "payees": payees,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/processor/{}/intent", self.base_url, uuid, processor);
        let res = self.post(&url, serde_json::Value::Object(payload)).await?;
        let intent: PaymentIntent = res.json().await?;

        Ok(intent)
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
