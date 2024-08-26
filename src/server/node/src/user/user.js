import db from '../persistence/db.js';

const user = {
  getUserByUUID: async (uuid) => {
    const foundUser = await db.getUser(uuid);
    return foundUser;
  }, 

  getUserByPublicKey: async (pubKey) => {
    const foundUser = await db.getUserByPublicKey(pubKey);
    return foundUser;
  },

  putUser: async (newUser) => {
    const uuid = await db.putUser(newUser);

    newUser.uuid = uuid; 

    return newUser;
  },

  saveUser: async (updatedUser) => {
    return await db.saveUser(updatedUser);
  },
  
  deleteUser: async (userToDelete) => {
    return (await db.deleteUser(userToDelete));
  }
};

export default user;
