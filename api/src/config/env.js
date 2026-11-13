// Reads settings from environment variables (and .env when running locally).
// Every other file gets its settings from here, never from process.env.
require('dotenv').config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`${name} must be a whole number`);
  return n;
}

const env = {
  nodeEnv,
  isTest: nodeEnv === 'test',
  isProduction: nodeEnv === 'production',

  // A3: the API runs on its own port (3000); the website runs on 5000.
  port: int('PORT', 3000),

  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/budget_golfers',

  jwtSecret: process.env.JWT_SECRET || (nodeEnv === 'production' ? '' : 'dev-only-secret-change-me'),
  // Website tokens last one hour (A2 section 6.5).
  jwtExpiresIn: int('JWT_EXPIRES_IN', 3600),
  // The phone app signs in once and uploads in the background, so its token
  // lasts longer. Only issued when the login body says client "mobile-app".
  jwtAppExpiresIn: int('JWT_APP_EXPIRES_IN', 60 * 60 * 24 * 30),

  bcryptCost: int('BCRYPT_COST', 12),

  // Comma-separated list of website origins allowed by CORS.
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5000,http://127.0.0.1:5000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  rateLimitEnabled: (process.env.RATE_LIMIT || (nodeEnv === 'test' ? 'off' : 'on')) !== 'off',
  logRequests: nodeEnv !== 'test',
};

if (!env.jwtSecret) {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = env;
