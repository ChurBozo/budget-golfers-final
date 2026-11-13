# Budget Golfers API

The REST API behind the Budget Golfers website and Android app. It is built with Node.js, Express 5 and MongoDB (through Mongoose), and follows the Assignment 2 design: 17 endpoints, JSON responses in one envelope, and a layered MVC structure.

- Runs on **port 3000** (the website runs on 5000).
- Every response is JSON: `{ "success": true, "data": …, "meta"?: …, "links"?: … }`, or `{ "success": false, "error": { status, code, message, details?, requestId } }`.
- Any route that does not exist returns **HTTP 404** with a JSON error.

## Quick start

You need Node.js 20 or later and MongoDB: either MongoDB Community Server running locally, or a free MongoDB Atlas cluster.

```bash
cd api
npm install
cp .env.example .env      # Windows: copy .env.example .env   (then set MONGODB_URI if needed)
npm run seed              # loads the test data into MongoDB
npm start                 # http://localhost:3000
```

Open http://localhost:3000/api/health to check it is running, then sign in with any test account. Every account's password is `Correct-Horse-7`; the main one is `aroha.m@example.com` (see `docs/database.md` for all of them).

**Global npm modules:** none are needed. Everything, including `nodemon`, `jest` and `newman`, is installed locally by `npm install` and run through the npm scripts below.

## npm scripts

| Script | What it does |
| --- | --- |
| `npm start` | Starts the API on `PORT` (3000) |
| `npm run dev` | Starts it with nodemon, restarting on every change |
| `npm run seed` | Drops and reloads the test data from `seed/data/*.json` (`-- --relative` moves the dates up to today) |
| `npm run seed:generate` | Regenerates `seed/data/*.json` (deterministic) |
| `npm test` | Runs all 108 automated tests |
| `npm run test:unit` | Runs only the tests that need no database |
| `npm run test:integration` | Runs the endpoint tests against a throwaway MongoDB |
| `npm run postman` | Runs the Postman collection with Newman (the API must be running) |

## Environment variables (`.env`)

| Name | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/budget_golfers` | Database connection string |
| `JWT_SECRET` | dev value (required in production) | Signs the sign-in tokens |
| `JWT_EXPIRES_IN` | `3600` | Website token life in seconds (1 hour) |
| `JWT_APP_EXPIRES_IN` | `2592000` | App token life in seconds (30 days) |
| `CORS_ORIGINS` | `http://localhost:5000,http://127.0.0.1:5000` | Website addresses allowed to call the API |
| `BCRYPT_COST` | `12` | Password hashing cost |

## Endpoints

| Method | Path | Access | Success |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | 201 |
| POST | `/api/auth/login` | Public | 200 |
| GET | `/api/users/me` | Token | 200 |
| PATCH | `/api/users/:userId` | Owner | 200 |
| DELETE | `/api/users/:userId` | Owner | 204 |
| GET | `/api/users/:userId/export?format=csv\|json` | Owner | 200 |
| GET | `/api/rounds?from&to&courseId&holes&sort&page&limit` | Token | 200 |
| POST | `/api/rounds` | Token | 201 (200 if already uploaded) |
| GET | `/api/rounds/:roundId` | Owner | 200 |
| PATCH | `/api/rounds/:roundId` | Owner | 200 |
| DELETE | `/api/rounds/:roundId` | Owner | 204 |
| GET | `/api/courses?search&region&page&limit` | Token | 200 |
| GET | `/api/courses/:courseId` | Owner | 200 |
| GET | `/api/stats/:userId?period=last5\|last20\|year\|all` | Owner | 200 |
| GET | `/api/clubs/:userId` | Owner | 200 |
| PUT | `/api/clubs/:userId` | Owner | 200 |
| GET | `/api/leaderboard?sort=avgScore\|improved\|rounds&period=season\|month\|all&page&limit` | Token | 200 |

The CRUD matrix, status codes and error codes are in `docs/CRUD-matrix.md`. Example request and response bodies are in `../docs/json/api/`.

## Design pattern: layered MVC

A request passes through the layers in order. Each folder in `src/` is one layer, and the `require()` links follow the arrows: routes require controllers, controllers require services and views, and only services require models.

```
request → middleware → routes → controllers → services → models → MongoDB
                                     ↓
                                   views → JSON response
```

```
api/
├── src/
│   ├── server.js            entry point: connect to MongoDB, listen on port 3000
│   ├── app.js               builds the Express app: middleware, /api router, 404, error handler
│   ├── config/              env.js (settings from .env), db.js (Mongoose connection)
│   ├── middleware/          cross-cutting: requestId, requireAuth, requireSelf, validate,
│   │                        rateLimits, notFound (default 404 route), errorHandler
│   ├── routes/              ROUTER: one express.Router per resource; maps method + path to
│   │                        middleware and a controller function, with no logic
│   ├── validators/          zod schemas for bodies and queries (A2 Table 10 rules)
│   ├── controllers/         CONTROLLER: reads the request, calls a service, picks the status code
│   ├── services/            business rules: totals, de-duplication, self-named courses,
│   │   └── calc/            pure calculations (no Express or Mongoose), unit tested:
│   │                        totals, geo, handicap, stats, clubStats, leaderboard, periods, snapshot
│   ├── models/              MODEL: Mongoose schemas, validation and indexes; the only code
│   │                        that talks to MongoDB
│   ├── views/               VIEW: shapes every JSON response (envelope, user, round, course,
│   │                        club, leaderboard, export) and removes internal fields
│   └── utils/               AppError (status + error code), club codes, slugs
├── seed/                    data/*.json (test data), seed.js, generate.js, check-database.mongosh.js
├── tests/                   unit/, http/, integration/ (Jest + Supertest)
├── postman/                 Postman collection and environment
└── docs/                    CRUD matrix, database, testing, test-results/
```

The split between controllers and services is the one addition to plain MVC: it keeps HTTP details out of the calculations, so the leaderboard ranking and club averages can be unit tested without starting a server.

## Security

- Passwords are hashed with bcrypt (cost 12) and never returned.
- Tokens are signed JWTs (HS256) holding only the user id.
- Every query includes the caller's id (no broken object-level authorisation).
- Bodies are validated and unknown fields are removed, so a client cannot set `role`, `totals` or club stats.
- `helmet` sets the security headers; CORS only allows the website's address; JSON bodies are limited to 1 MB.
- The sign-in and register routes are rate limited.
- The CSV export blocks spreadsheet formula injection.

## Deploying to Render (free)

1. Create a free MongoDB Atlas cluster, add a database user, and allow access from anywhere (`0.0.0.0/0`).
2. On Render, create a **Web Service** from the repository with root directory `api`, build command `npm install` and start command `npm start`.
3. Add the environment variables `MONGODB_URI` (the Atlas string), `JWT_SECRET` (a long random string), `NODE_ENV=production` and `CORS_ORIGINS` (the website's address).
4. Run `npm run seed` once from your computer with `MONGODB_URI` pointing at Atlas.
