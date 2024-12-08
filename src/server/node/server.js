import express from 'express';
import cors from 'cors';
import { createHash } from 'node:crypto';
import user from './src/user/user.js';
import processors from './src/processors/processors.js';
import MAGIC from './src/magic/magic.js';
import db from './src/persistence/db.js';
import fount from 'fount-js';
import bdo from 'bdo-js';
import sessionless from 'sessionless-node';

const stripe = processors.stripe;

const allowedTimeDifference = 300000; // keep this relaxed for now

const app = express();
app.use(cors());
app.use(express.json());

const SUBDOMAIN = process.env.SUBDOMAIN || 'dev';
fount.baseURL = process.env.LOCALHOST ? 'http://localhost:3006/' : `${SUBDOMAIN}.fount.allyabase.com/`;
bdo.baseURL = process.env.LOCALHOST ? 'http://localhost:3003/' : `${SUBDOMAIN}.bdo.allyabase.com/`;
const bdoHashInput = `${SUBDOMAIN}addie`;

const bdoHash = createHash('sha256').update(bdoHashInput).digest('hex');

const repeat = (func) => {
  setTimeout(func, 2000);
};

const bootstrap = async () => {
  try {
    const fountUser = await fount.createUser(db.saveKeys, db.getKeys);
console.log('f', fountUser);
    const bdoUUID = await bdo.createUser(bdoHash, {}, () => {}, db.getKeys);
console.log('b', bdoUUID);
    const spellbooks = await bdo.getSpellbooks(bdoUUID, bdoHash);
    const addie = {
      uuid: 'addie',
      fountUUID: fountUser.uuid,
      fountPubKey: fountUser.pubKey,
      bdoUUID,
      spellbooks
    };

    if(!addie.fountUUID || !addie.bdoUUID || !spellbooks || spellbooks.length === 0) {
      throw new Error('bootstrap failed');
    }

    await db.saveUser(addie);
  } catch(err) {
console.warn(err);
    repeat(bootstrap);
  }
};

repeat(bootstrap);

app.use((req, res, next) => {
  const requestTime = +req.query.timestamp || +req.body.timestamp;
  const now = new Date().getTime();
  if(Math.abs(now - requestTime) > allowedTimeDifference) {
    return res.send({error: 'no time like the present'});
  }
  next();
});

app.use((req, res, next) => {
  console.log('\n\n', req.body, '\n\n');
  next();
});

app.put('/user/create', async (req, res) => {
  try {
    const pubKey = req.body.pubKey;
    const message = req.body.timestamp +  pubKey;
    const signature = req.body.signature;

    if(!signature || !sessionless.verifySignature(signature, message, pubKey)) {
console.log('auth error');
      res.status(403);
      return res.send({error: 'auth error'});
    }

    const foundUser = await user.putUser({ pubKey });
    res.send(foundUser);
  } catch(err) {
console.warn(err);
    res.status(404);
    res.send({error: 'not found'});
  }
});

app.get('/user/:uuid', async (req, res) => {
  try {
    const uuid = req.params.uuid;
    const timestamp = req.query.timestamp;
    const signature = req.query.signature;
    const message = timestamp + uuid;

    const foundUser = await user.getUserByUUID(req.params.uuid);

    if(!signature || !sessionless.verifySignature(signature, message, foundUser.pubKey)) {
      res.status(403);
      return res.send({error: 'auth error'});
    }

    res.send(foundUser);
  } catch(err) {
    res.status(404);
    res.send({error: 'not found'});
  }
});

app.put('/user/:uuid/processor/:processor', async (req, res) => {
  try {
    const uuid = req.params.uuid;
    const processor = req.params.processor;
    const body = req.body;
    const timestamp = body.timestamp;
    const country = body.country;
    const name = body.name;
    const email = body.email;
    const signature = body.signature;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const foundUser = await user.getUserByUUID(uuid);

    const message = timestamp + uuid + name + email;

    if(!sessionless.verifySignature(signature, message, foundUser.pubKey)) {
      res.status(403);
      return res.send({error: 'Auth error'});
    }

    let updatedUser = foundUser;

    switch(processor) {
      case 'stripe': updatedUser = await stripe.putStripeAccount(foundUser, country, name, email, ip);
        break;
      default: throw new Error('processor not found');
    }

    res.send(updatedUser);
  } catch(err) {
console.warn(err);
    res.status(404);
console.log('set status');
    res.send({error: err});
  }
});

app.post('/user/:uuid/processor/:processor/intent', async (req, res) => {
  try {
console.log('trying to get payment intent');
    const uuid = req.params.uuid;
    const processor = req.params.processor;
    const body = req.body;
    const timestamp = body.timestamp;
    const amount = body.amount;
    const currency = body.currency;
    const payees = body.payees;
    const signature = body.signature;

    const foundUser = await user.getUserByUUID(uuid);

    const message = timestamp + uuid + amount + currency;

    if(!sessionless.verifySignature(signature, message, foundUser.pubKey)) {
      res.status(403);
      return res.send({error: 'Auth error'});
    }
console.log('past auth');

    let paymentTokenResponse;

    switch(processor) {
      case 'stripe': paymentTokenResponse = await stripe.getStripePaymentIntent(foundUser, amount, currency, payees);
        break;
      default: throw new Error('processor not found');
    }

console.log('paymentTokenResponse', paymentTokenResponse);

    res.send(paymentTokenResponse);
  } catch(err) {
console.log(err);
    res.status(404);
    res.send({error: err});
  }
});

app.post('/user/:uuid/processor/:processor/intent-without-splits', async (req, res) => {
  try {
console.log('trying to get payment intent');
    const uuid = req.params.uuid;
    const processor = req.params.processor;
    const body = req.body;
    const timestamp = body.timestamp;
    const amount = body.amount;
    const currency = body.currency;
    const signature = body.signature;

    const foundUser = await user.getUserByUUID(uuid);

    const message = timestamp + uuid + amount + currency;

    if(!sessionless.verifySignature(signature, message, foundUser.pubKey)) {
      res.status(403);
      return res.send({error: 'Auth error'});
    }
console.log('past auth');

    let paymentTokenResponse;

    switch(processor) {
      case 'stripe': paymentTokenResponse = await stripe.getStripePaymentIntentWithoutSplits(foundUser, amount, currency);
        break;
      default: throw new Error('processor not found');
    }

console.log('paymentTokenResponse', paymentTokenResponse);

    res.send(paymentTokenResponse);
  } catch(err) {
console.log(err);
    res.status(404);
    res.send({error: err});
  }
});

app.post('/magic/spell/:spellName', async (req, res) => {
console.log('got spell req');
  try {
    const spellName = req.params.spellName;
    const spell = req.body;

    if(!MAGIC[spellName]) {
console.log('sending this back'); 
      res.status(404);
      res.send({error: 'spell not found'});
    }

    let spellResp = {};
    spellResp = await MAGIC[spellName](spell);
console.log('spellResp', spellResp);
    res.status(spellResp.success ? 200 : 900);
    return res.send(spellResp);
  } catch(err) {
console.warn(err);
    res.status(404);
    res.send({error: 'not found'});
  }
});

app.post('/money/processor/:processor/user/:uuid', async (req, res) => {
  try {
    const processor = req.params.processor;
    const uuid = req.params.uuid;
    const timestamp = req.body.timestamp;
    const caster = req.body.caster;
    const spell = req.body.spell;
    const payees = req.body.gatewayUsers;
    const signature = req.body.signature;
    const message = timestamp + uuid;

    const foundUser = await user.getUserByUUID(uuid);

    if(!sessionless.verifySignature(signature, message, foundUser.pubKey)) {
      res.status(403);
      return res.send({error: 'Auth error'});
    }
console.log('past auth');
console.log('caster', caster);
    const addieCaster = await user.getUserByPubKey(casterPubKey);
console.log('addieCaster', addieCaster);

    if(!caster[processor] || caster[processor].stored < spell.totalCost) {
      return res.send({success: false});
    }

    let paidOutResult;
    switch(processor) {
      case 'stripe': await stripe.payPayees(payees, spell.totalCost);
        break;
      default: throw new Error('processor not found');
    }
    
    res.send({success: paidOutResult});  

  } catch(err) {
console.warn(err);
    res.status(404);
    res.send({error: 'not found'});
  }
});

app.delete('/user/:uuid', async (req, res) => {
  try {
    const uuid = req.params.uuid;
    const timestamp = req.body.timestamp;
    const signature = req.body.signature;
    const message = timestamp + uuid;

    const foundUser = await user.getUserByUUID(uuid);

    if(!signature || !sessionless.verifySignature(signature, message, foundUser.pubKey)) {
      res.status(403);
      return res.send({error: 'auth error'});
    }

    const result = await user.deleteUser(foundUser);

    res.send({success: result});
  } catch(err) {
console.warn(err);
    res.status(404);
    res.send({error: 'not found'});
  }
});

app.listen(3005);
console.log('Let\'s add it up');
