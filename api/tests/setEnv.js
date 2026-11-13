// Test settings, applied before any app code is loaded.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.BCRYPT_COST = '4'; // fast hashing in tests
process.env.RATE_LIMIT = 'off';
