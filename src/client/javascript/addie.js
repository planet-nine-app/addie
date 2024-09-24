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

  addProcessorAccount: async (uuid, processorPayload) => {
    return 'unimplemented';
  },

  getPaymentIntent: async (uuid, processor, processorPayload) => {
    return 'unimplemented';
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
