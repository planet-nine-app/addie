import express from 'express';
import user from './src/user/user.js';
import processors from './src/processors/processors.js';
import sessionless from 'sessionless-node';

const allowedTimeDifference = 300000; // keep this relaxed for now

const app = express();
app.use(express.json());

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
      res.status(403);
      return res.send({error: 'auth error'});
    }

    const foundUser = await user.putUser(req.body.user);
    res.send(foundUser);
  } catch(err) {
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

    const foundUser = await user.getUser(req.params.uuid);

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
    const name = body.name;
    const email = body.email;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const foundUser = await user.getUser(uuid);

    const message = timestamp + uuid

    if(!sessionless.verifySignature(signature, message, foundUser.pubKey)) {
      res.status = 403;
      return res.send({error: 'Auth error'});
    }

    let updatedUser = foundUser;

    switch(processor) {
      case 'stripe': updatedUser = await processors.putStripeAccount(foundUser, name, email, ip);
        break;
      default: throw new Error('processor not found');
    }

    res.send(updatedUser);
  } catch(err) {
    res.status = 404;
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

    const foundUser = await user.getUser(uuid);

    const message = timestamp + uuid + amount + currency;

    if(!sessionless.verifySignature(signature, message, foundUser.pubKey)) {
      res.status = 403;
      return res.send({error: 'Auth error'});
    }
console.log('past auth');

    let paymentTokenResponse;

    switch(processor) {
      case 'stripe': paymentTokenResponse = await processors.getStripePaymentIntent(foundUser, amount, currency, payees);
      default: throw new Error('processor not found');
    }

    res.send(response);
  } catch(err) {
console.log(err);
    res.status = 404;
    res.send({error: err});
  }
});









app.delete('/user/:uuid', async (req, res) => {
  try {
    const uuid = req.params.uuid;
    const timestamp = req.body.timestamp;
    const signature = req.body.signature;
    const message = timestamp + uuid;

    const foundUser = await user.getUser(req.params.uuid);

    if(!signature || !sessionless.verifySignature(signature, message, foundUser.pubKey)) {
      res.status(403);
      return res.send({error: 'auth error'});
    }

    const result = await user.deleteUser(foundUser);

    res.send({success: result});
  } catch(err) {
    res.status(404);
    res.send({error: 'not found'});
  }
});