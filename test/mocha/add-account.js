import { should } from 'chai';
should();
import sessionless from 'sessionless-node';
import superAgent from 'superagent';

const baseURL = process.env.SUB_DOMAIN ? `https://${process.env.SUB_DOMAIN}.addie.allyabase.com/` : 'http://127.0.0.1:3005/';

const get = async function(path) {
  console.info("Getting " + path);
  return await superAgent.get(path).set('Content-Type', 'application/json');
};

const put = async function(path, body) {
  console.info("Putting " + path);
  return await superAgent.put(path).send(body).set('Content-Type', 'application/json');
};

const post = async function(path, body) {
  console.info("Posting " + path);
console.log(body);
  return await superAgent.post(path).send(body).set('Content-Type', 'application/json');
};

const _delete = async function(path, body) {
  //console.info("deleting " + path);
  return await superAgent.delete(path).send(body).set('Content-Type', 'application/json');
};

let savedUser = {};
let keys = {
  privateKey: 'd0f657d2c7092f422673c9fde0610917ff9bbbed4d0c110fbabdd7162705b1e7',
  pubKey: '03ac11a86a21bb4e9cf8fdbfbaeb2138030dbc4b47d821985bd3717827b1c3fc8d'
};
let keysToReturn = keys;

it('should register a user', async () => {
  await sessionless.generateKeys((k) => {  }, () => {return keysToReturn;});
  const payload = {
    timestamp: new Date().getTime() + '',
    pubKey: keys.pubKey,
  };

  payload.signature = await sessionless.sign(payload.timestamp + payload.pubKey);

  const res = await put(`${baseURL}user/create`, payload);
console.log(res.body);
  savedUser = res.body;
  res.body.uuid.length.should.equal(36);
});

it('should put an account to a processor', async () => {
  const payload = {
    timestamp: new Date().getTime() + '',
    name: "Poppy Collective PDX",
    email: "hello@poppycollectivepdx.com"
  };

  const message = payload.timestamp + savedUser.uuid + payload.name + payload.email;

  payload.signature = await sessionless.sign(message);

  const res = await put(`${baseURL}user/${savedUser.uuid}/processor/stripe`, payload);
  savedUser = res.body;
console.log('stripe account id', savedUser.stripeAccountId);
  savedUser.stripeAccountId.should.not.equal(null);
}).timeout(60000);


