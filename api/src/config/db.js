// Opens and closes the MongoDB connection through Mongoose.
const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

async function connect(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  // Build the indexes from Table 11 (unique email, clientRoundId de-dup, ...).
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  return mongoose.connection;
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect };
