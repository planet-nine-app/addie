# Addie

This is the JavaScript client SDK for the Addie miniservice. 

### Usage

```javascript
import addie from 'addie-js';

const saveKeys = (keys) => { /* handle persisting keys here */ };
const getKeys = () => { /* return keys here. Can be async */ };

const uuid = await addie.createUser(saveKeys, getKeys);

// unimplemented const updatedUser = await addie.addProcessorAccount(uuid, /* processorInfo - there is a reference stripe implementation in the repo, but not quite ready for public release yet */);

// unimplemented const paymentIntent = await addie.getPaymentIntent(uuid, <processor>, <processorInfo>);

const deleted = await addie.deleteUser(uuid, newStateHash); // returns true on success
```
