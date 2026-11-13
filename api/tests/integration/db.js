// Starts a throwaway MongoDB for the integration tests.
//  - If MONGODB_TEST_URI is set (for example a local MongoDB), a fresh
//    database with a random name is used and dropped afterwards.
//  - Otherwise mongodb-memory-server starts an in-memory MongoDB. The first
//    run downloads the MongoDB binary (about 100 MB), later runs reuse it.
//    Set MONGOMS_SYSTEM_BINARY to use a mongod you already have.
const mongoose = require('mongoose');
const db = require('../../src/config/db');
require('../../src/models');

let memory;

async function start() {
  let uri = process.env.MONGODB_TEST_URI;
  if (uri) {
    const name = `bg_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    // Keep the scheme, credentials and host; swap in the new database name.
    // Works with or without a trailing slash, a database name or ?options.
    const [base, options] = uri.split('?');
    const server = base.match(/^mongodb(?:\+srv)?:\/\/[^/]+/)[0];
    uri = `${server}/${name}${options ? `?${options}` : ''}`;
  } else {
    const { MongoMemoryServer } = require('mongodb-memory-server-core');
    memory = await MongoMemoryServer.create();
    uri = memory.getUri('budget_golfers_test');
  }
  await db.connect(uri);
}

async function clear() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function stop() {
  if (mongoose.connection.readyState === 1 && process.env.MONGODB_TEST_URI) {
    await mongoose.connection.db.dropDatabase();
  }
  await db.disconnect();
  if (memory) await memory.stop();
}

module.exports = { start, clear, stop };
