// Entry point: connect to MongoDB, then listen on port 3000.
const env = require('./config/env');
const db = require('./config/db');
require('./models'); // register the Mongoose models before indexes are built
const createApp = require('./app');

async function start() {
  try {
    await db.connect(env.mongoUri);
    console.log(`MongoDB connected: ${redact(env.mongoUri)}`);
  } catch (err) {
    console.error('Could not connect to MongoDB. Check MONGODB_URI in .env.', err.message);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Budget Golfers API listening on http://localhost:${env.port}`);
  });

  const stop = async () => {
    server.close();
    await db.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

function redact(uri) {
  return uri.replace(/\/\/([^@/]+)@/, '//***@');
}

start();
