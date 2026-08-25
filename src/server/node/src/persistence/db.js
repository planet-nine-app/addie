import sessionless from 'sessionless-node';
  
// esbuild's CJS output target (used by Netlify's function bundler) doesn't
// support top-level await, so the client is now a lazily-resolved promise -
// call sites now do `(await client).get(...)` instead of `client.get(...)`.
const client = (async () => {
  const { createClient } = process.env.PERSISTENCE_BACKEND === 'netlify-blobs'
    ? await import('./client.netlify-blobs.js')
    : await import('./client.js');

  return createClient()
    .on('error', err => console.log('Client Error', err))
    .connect();
})();
    
const db = {
  getUser: async (uuid) => {
    const user = await (await client).get(`user:${uuid}`);
    if(!user) {
console.log('throwing');
      throw new Error('not found');
    }
    let parsedUser = JSON.parse(user);
    return parsedUser; 
  },

  getUserByPublicKey: async (pubKey) => {
    const uuid = await (await client).get(`pubKey:${pubKey}`);
    const user = await (await client).get(`user:${uuid}`);
    if(!user) {
      // Unlike getUser (fetching a *known* uuid, where not-found really is an
      // error), this is used by PUT /user/create to check whether a pubKey is
      // already registered - a brand-new pubKey not existing yet is the
      // normal case, not a failure. Throwing here used to unwind into
      // addie.js's outer route catch before it ever reached the actual
      // user-creation code, so no new pubKey could ever successfully register.
      return null;
    }
    let parsedUser = JSON.parse(user);
    return parsedUser;
  },

  putUser: async (user) => {
    const uuid = sessionless.generateUUID();
    user.uuid = uuid;
    await (await client).set(`user:${uuid}`, JSON.stringify(user));
    await (await client).set(`pubKey:${user.pubKey}`, uuid);
    return uuid;
  },

  saveUser: async (user) => {
    await (await client).set(`user:${user.uuid}`, JSON.stringify(user));
    return true;
  },

  deleteUser: async (user) => {
    await (await client).del(`pubKey:${user.pubKey}`);
    const resp = await (await client).del(`user:${user.uuid}`);

    return true;
  },

  saveKeys: async (keys) => {
    await (await client).set(`keys`, JSON.stringify(keys));
  },

  getKeys: async () => {
    const keyString = await (await client).get('keys');
    return JSON.parse(keyString);
  },

  saveExpressAccountByEmail: async (email, accountId) => {
    await client.set(`stripeExpressEmail:${email}`, accountId);
  },

  getExpressAccountByEmail: async (email) => {
    return await client.get(`stripeExpressEmail:${email}`);
  }

};

export default db;
