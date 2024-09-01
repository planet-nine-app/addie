import addie from '../../src/client/javascript/addie.js';
import { should } from 'chai';
should();

console.log(addie);

const savedUser = {};
let keys = {};
const hash = 'firstHash';
const secondHash = 'secondHash';

it('should register a user', async () => {
  const uuid = await addie.createUser((k) => { keys = k; }, () => { return keys; });
  savedUser.uuid = uuid;
  savedUser.uuid.length.should.equal(36);
});

it('should add processor account', async () => {
  const res = await addie.addProcessorAccount(savedUser.uuid, {});
  res.should.equal('unimplemented');
});

it('should get payment intent', async () => {
  const res = await addie.getPaymentIntent(savedUser.uuid, 'processor', {});
  res.should.equal('unimplemented');
});

it('should delete a user', async () => {
  const res = await addie.deleteUser(savedUser.uuid);
  res.should.equal(true);
});
