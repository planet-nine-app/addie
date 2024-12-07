use crate::{AddieUser, Addie, Gateway, Nineum, Spell, SpellResult, SuccessResult, PaymentIntent};
use sessionless::hex::IntoHex;
use std::collections::HashMap;
use serde_json::json;
use serde_json::Value;
use rand::Rng;

#[actix_rt::test]
async fn test_addie() {

    let mut saved_user: Option<AddieUser>;
    let addie = Addie::new(Some("http://localhost:3005/".to_string()));

    async fn create_user(addie: &Addie) -> Option<AddieUser> {
	let result = addie.create_user().await;

	match result {
	    Ok(user) => {
		println!("Successfully got AddieUser: {}", user.uuid);
		assert_eq!(
		    user.uuid.len(),
		    36
		);
                Some(user)
	    },
	    Err(error) => {
		eprintln!("Error occurred create_user: {}", error);
		println!("Error details: {:?}", error);
                None
	    }
	}
    }

    async fn get_user_by_uuid(addie: &Addie, saved_user: &AddieUser) -> Option<AddieUser> {
	let result = addie.get_user_by_uuid(&saved_user.uuid).await; 
     
	match result {
	    Ok(user) => {
		assert_eq!(
		    user.uuid.len(),
		    36
		);
                Some(user)
	    }
	    Err(error) => {
		eprintln!("Error occurred get_user: {}", error);
		println!("Error details: {:?}", error);
                None
	    }
	} 
    }

    async fn add_processor_account(addie: &Addie, saved_user: &AddieUser) -> Option<AddieUser> {
        let email_seed: u32 = rand::thread_rng().gen_range(0..100000);
        let email: String = format!("zach+{}@planetnine.app", &email_seed);
        let result = addie.add_processor_account(&saved_user.uuid, "Foo", &email).await;

        match result {
            Ok(user) => {
                assert_eq!(
                    user.uuid.len(),
                    36
                );
                Some(user)
            }
            Err(error) => {
                eprintln!("Error occurred get_user: {}", error);
                println!("Error details: {:?}", error);
                None
            }
        } 
    }

    async fn get_payment_intent(addie: &Addie, saved_user: &AddieUser) -> Option<PaymentIntent> {
        let payees: Vec<String> = Vec::new();
        let result = addie.get_payment_intent(&saved_user.uuid, "stripe", &2000, "USD", &payees).await;

        match result {
            Ok(intent) => {
                assert_eq!(
                    intent.customer.len(),
                    18
                );
                Some(intent)
            }
            Err(error) => {
                eprintln!("Error occurred get_user: {}", error);
                println!("Error details: {:?}", error);
                None
            }
        }
    }

    async fn get_payment_intent_without_splits(addie: &Addie, saved_user: &AddieUser) -> Option<PaymentIntent> {
        let result = addie.get_payment_intent_without_splits(&saved_user.uuid, "stripe", &2000, "USD").await;

        match result {
            Ok(intent) => {
                assert_eq!(
                    intent.customer.len(),
                    18
                );
                Some(intent)
            }
            Err(error) => {
                eprintln!("Error occurred get_user: {}", error);
                println!("Error details: {:?}", error);
                None
            }
        }
    }

    async fn delete_user(addie: &Addie, saved_user: &AddieUser) -> Option<SuccessResult> {
        let result = addie.delete_user(&saved_user.uuid).await;

        match result {
            Ok(success) => {
                assert_eq!(
                    success.success,
                    true
                );
                Some(success)
            }
            Err(error) => {
                eprintln!("Error occurred delete: {}", error);
                println!("Error details: {:?}", error);
                None
            }
        }
    }

    saved_user = Some(create_user(&addie).await.expect("user"));

    if let Some(ref user) = saved_user {
        saved_user = Some(get_user_by_uuid(&addie, user).await.expect("get user 1"));
    } else {
        panic!("Failed to get user");
    }

    if let Some(ref user) = saved_user {
	Some(add_processor_account(&addie, user).await.expect("add processor"));
        saved_user = Some(get_user_by_uuid(&addie, user).await.expect("adding processor account"));
    } else {
	panic!("Failed to add processor account");
    }

    if let Some(ref user) = saved_user {
        Some(get_payment_intent(&addie, user).await.expect("get payment intent"));
        saved_user = Some(get_user_by_uuid(&addie, user).await.expect("getting payment intent"));
    } else {
        panic!("Failed to get payment intent");
    }

    if let Some(ref user) = saved_user {
        Some(get_payment_intent_without_splits(&addie, user).await.expect("get payment intent without splits"));
        saved_user = Some(get_user_by_uuid(&addie, user).await.expect("getting payment intent"));
    } else {
        panic!("Failed to get payment intent");
    }
    
    if let Some(ref user) = saved_user {
	delete_user(&addie, &user).await;
    } else {
	panic!("Failed to delete user");
    }     
}
