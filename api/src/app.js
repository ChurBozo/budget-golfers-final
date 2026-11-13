// Builds the Express app: security and parsing middleware, the API router,
// the default 404 route and the error handler. server.js starts it; the
// tests import it directly so they can call it without opening a port.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const requestId = require('./middleware/requestId');
const { apiLimiter } = require('./middleware/rateLimits');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const apiRouter = require('./routes');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render sits behind one proxy; needed for rate limits.

  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, done) {
        // Phone apps and Postman send no Origin header, so allow those.
        if (!origin || env.corsOrigins.includes(origin)) return done(null, true);
        return done(null, false);
      },
      // Content-Disposition carries the export's file name to the website.
      exposedHeaders: ['Location', 'X-Request-Id', 'Content-Disposition'],
    }),
  );
  if (env.logRequests) {
    morgan.token('id', (req) => req.id);
    app.use(morgan(':id :method :url :status :response-time ms'));
  }
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiLimiter, apiRouter);

  // Friendly root so opening http://localhost:3000 shows the API is running.
  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: { name: 'Budget Golfers API', version: '1.0.0', docs: '/api', health: '/api/health' },
    });
  });

  // Default route: anything not matched above is a JSON 404.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
