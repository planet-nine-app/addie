import sessionless from 'sessionless-node';
import fetch from 'node-fetch';

const get = async (url) => {
  return await fetch(url);
};

const post = async (url, payload) => {
  return await fetch(url, {
    method: 'post',
    body: JSON.stringify(payload),
    headers: {'Content-Type': 'application/json'}
  });
};

const put = async (url, payload) => {
  return await fetch(url, {
    method: 'put',
    body: JSON.stringify(payload),
    headers: {'Content-Type': 'application/json'}
  });
};

const _delete = async (url, payload) => {
  return await fetch(url, {
    method: 'delete',
    body: JSON.stringify(payload),
    headers: {'Content-Type': 'application/json'}
  });
};

const addie = {
  baseURL: 'https://dev.addie.allyabase.com/',

  createUser: async (saveKeys, getKeys) => {
    const keys = (await getKeys()) || (await sessionless.generateKeys(saveKeys, getKeys))
    sessionless.getKeys = getKeys;

    const payload = {
      timestamp: new Date().getTime() + '',
      pubKey: keys.pubKey
    };

    payload.signature = await sessionless.sign(payload.timestamp + payload.pubKey);

    const res = await put(`${addie.baseURL}user/create`, payload);
    const user = await res.json();
    const uuid = user.uuid;

    return uuid;
  },

  getUserByUUID: async (uuid) => {
    const timestamp = new Date().getTime() + '';
    
    const message = timestamp + uuid;
    
    const signature = await sessionless.sign(message);

    const res = await get(`${addie.baseURL}user/${uuid}?signature=${signature}&timestamp=${timestamp}`);
    const user = await res.json();
    
    return user;
  },

  addProcessorAccount: async (uuid, processorPayload) => {
    return 'unimplemented';
  },

  getPaymentIntent: async (uuid, processor, amount, currency, payees) => {
    const timestamp = new Date().getTime() + '';
    const message = timestamp + uuid + amount + currency;
    const signature = await sessionless.sign(message);

    const payload = {
	timestamp,
	amount,
	currency,
	"payees": payees,
	"signature": signature
    };

    const url = `${addie.baseURL}user/${uuid}/processor/${processor}/intent`;
    const res = await post(url, payload);   //  Start here
    const intent = await res.json();

    return intent;
  },

  getPaymentIntentWithoutSplits: async (uuid, processor, amount, currency) => {
    const timestamp = new Date().getTime() + '';
    const message = timestamp + uuid + amount + currency;
    const signature = await sessionless.sign(message);

    const payload = {
	timestamp,
	amount,
	currency,
	"signature": signature
    };

    const url = `${addie.baseURL}user/${uuid}/processor/${processor}/intent-without-splits`;
    const res = await post(url, payload);   //  Start here
    const intent = await res.json();

    return intent;
  },

  deleteUser: async (uuid) => {
    const timestamp = new Date().getTime() + '';

    const signature = await sessionless.sign(timestamp + uuid);
    const payload = {timestamp, uuid, signature};


    const res = await _delete(`${addie.baseURL}user/${uuid}`, payload);
    return res.status === 200;
  }
};

export default addie;
