# Testing: Budget Golfers API

Three kinds of testing were done. All results are saved in `docs/test-results/`.

| Test | Tool | Result | Output |
| --- | --- | --- | --- |
| Automated tests: calculations, routes and every endpoint against a real MongoDB | Jest + Supertest | **108 passed, 0 failed** (8 suites) | `jest-output.txt`, `jest-results.json` |
| API test run of the whole collection | Postman collection run with Newman | **45 requests, 132 assertions, 0 failed** | `postman-report.html`, `postman-output.txt`, `postman-results.json` |
| Database checks: collections, counts, indexes, sample queries, duplicate blocking | mongosh | All checks as expected | `database-check.txt`, `seed-output.txt` |

The runs above used MongoDB 8.3 and Node.js 22, on 5 November 2026.

## 1. Automated tests (Jest)

```bash
npm test                    # everything
npm run test:unit           # calculations and HTTP behaviour; needs no database
npm run test:integration    # every endpoint against a throwaway MongoDB
```

The integration tests start an in-memory MongoDB with `mongodb-memory-server`, which downloads MongoDB the first time (about 100 MB). To use a MongoDB you already have instead, set `MONGODB_TEST_URI=mongodb://127.0.0.1:27017` (a new database with a random name is created and dropped).

| Suite | What it proves |
| --- | --- |
| `unit/totals.test.js` | Round totals, green in regulation, fairways only on par 4 and 5, GPS distances |
| `unit/leaderboard.test.js` | Leaderboard averages, improvement, ranking with ties, all three sorts |
| `unit/clubStats.test.js` | Club average, longest and spread; the 5-shot minimum; chips and putts left out |
| `unit/handicapAndStats.test.js` | Handicap estimate (WHS table), periods, dashboard statistics, the stats snapshot |
| `unit/utils.test.js` | Course name matching, CSV safety, error field paths, paging links, GeoJSON to `{ lat, lng }` |
| `http/routes.test.js` | Default 404 route, 401 without a token, 403 for someone else's data, every validation rule and its 400/422 message |
| `integration/api.test.js` | All 17 endpoints with a real database: register, login, profile, export, delete account; upload, duplicate upload (including three at once), self-named courses, GPS shots, filters, paging, corrections, deletes; stats; clubs; leaderboard privacy |
| `integration/seed.test.js` | Every seed document passes its schema, the test passwords work, and stored totals match what the API calculates |

## 2. Postman

`postman/BudgetGolfers.postman_collection.json` has 45 requests in 10 folders (Setup, Auth, Users, Rounds, Courses, Stats, Clubs, Leaderboard, Errors, Clean up). Every request has test scripts that check the status code, the JSON envelope and the fields from the A2 design.

**To run it in Postman:**
1. `npm run seed`, then `npm start`.
2. In Postman, *Import* both files in `postman/`.
3. Choose the **Budget Golfers local** environment (`baseUrl` = `http://localhost:3000`).
4. Open the collection, click **Run**, and run all folders in order.

**From the command line** (with the API running): `npm run postman`.

The run registers a throwaway golfer for the create, change and delete requests, and deletes it at the end, so the seed data is the same afterwards and the collection can be run again.

## 3. Database (mongosh)

```bash
mongosh "mongodb://127.0.0.1:27017/budget_golfers" seed/check-database.mongosh.js
```

It shows the collections and document counts, every index (A2 Table 11), a user without its password hash, the A2 example round, a query that uses the `userId_1_playedAt_-1` index (5 documents examined for 5 results), the leaderboard aggregation, club distances, a self-named course with no location, and MongoDB refusing a repeat upload and a repeat email with error E11000.

## 4. Dependency audit (npm audit)

`npm audit` lists about 30 advisories (the count changes as new ones are published). Only one is in a package the running API uses (saved in `test-results/npm-audit.txt`):

```bash
npm audit --omit=dev    # only the packages the server runs: 1 advisory, zod
```

The rest are inside Jest and Newman, the test tools. They are dev dependencies, so they are not installed on the server (Render runs with `NODE_ENV=production`, which leaves them out) and never handle a request.

**zod (GHSA-mrhx-c7xc-m3w5, high).** zod 3 checks every element of an array, even one that is already too long, and keeps every problem it finds. A test 1 MB body of 330,000 empty holes made 1.3 million problems, took 1.6 seconds and used about 350 MB of memory, which is enough to crash a small server. The patched version is zod 4, which changes the API the validators use, so `npm audit fix --force` was not run. Instead:

- `boundedArray()` in `src/validators/common.js` checks an array's length before its elements and stops at once if it is too long. Every array in a request body uses it: holes (18), shots per hole (20), corrected holes (18) and clubs (40).
- At most 50 field errors are sent back in a 422 reply.
- Bodies were already limited to 1 MB.

The same body now gives 2 problems in about 50 ms and uses about 20 MB (most of that is reading the JSON). Three tests in `http/routes.test.js` check this. `npm audit` still names zod, because it checks version numbers, not how the package is used.
