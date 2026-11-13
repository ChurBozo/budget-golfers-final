# CRUD matrix: Budget Golfers API

All 17 endpoints from the Assignment 2 design (Table 7) are implemented, plus `GET /api/health` and a default 404 route. Every route is defined in an Express router in `src/routes/`.

## 1. Resource paths and operations

Each row is a resource path. Each column is a CRUD operation and the HTTP method that performs it. "Owner" means the token's user must be the `:userId` (otherwise 403), or the round or course must belong to the caller (otherwise 404, so its existence is not revealed).

| Resource path | Create | Read | Update | Delete | Access | Router file |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/auth/register` | **POST** → 201 account + token | – | – | – | Public, rate limited | `auth.routes.js` |
| `/api/auth/login` | **POST** → 200 token (a new session) | – | – | – | Public, rate limited | `auth.routes.js` |
| `/api/users/me` | – | **GET** → 200 profile | – | – | Token | `users.routes.js` |
| `/api/users/:userId` | – | – | **PATCH** → 200 profile | **DELETE** → 204 | Owner | `users.routes.js` |
| `/api/users/:userId/export` | – | **GET** `?format=csv\|json` → 200 file | – | – | Owner | `users.routes.js` |
| `/api/rounds` | **POST** → 201 (200 if duplicate) | **GET** → 200 list | – | – | Token | `rounds.routes.js` |
| `/api/rounds/:roundId` | – | **GET** → 200 full round | **PATCH** → 200 | **DELETE** → 204 | Owner | `rounds.routes.js` |
| `/api/courses` | (created by POST `/api/rounds`) | **GET** → 200 list | – | – | Token | `courses.routes.js` |
| `/api/courses/:courseId` | – | **GET** → 200 course | – | – | Owner | `courses.routes.js` |
| `/api/stats/:userId` | – | **GET** `?period=` → 200 | – | – | Owner | `stats.routes.js` |
| `/api/clubs/:userId` | (default bag made on first GET) | **GET** → 200 bag | **PUT** → 200 bag | – | Owner | `clubs.routes.js` |
| `/api/leaderboard` | – | **GET** → 200 ranking | – | – | Token | `leaderboard.routes.js` |
| `/api/health` | – | **GET** → 200 | – | – | Public | `routes/index.js` |
| *anything else* | 404 | 404 | 404 | 404 | – | `middleware/notFound.js` |

**Why some cells are empty**
- **Stats and leaderboard are read-only.** They are calculated by the server from rounds, so no client can create or change them.
- **Courses are created when a round is uploaded.** Courses are self-named, so `POST /api/rounds` with `course.name` finds or creates the course. Courses are deleted with the account.
- **Clubs are replaced as a whole with PUT.** The bag is one document per golfer, and a full replace is simpler and safer than patching single clubs. The distances can never be sent by the client.
- **Accounts are created by `/auth/register`**, not by `POST /api/users`, because creating an account also signs the golfer in.

## 2. Endpoints × collections

The second matrix shows which MongoDB collection each endpoint creates (C), reads (R), updates (U) or deletes (D). It is used to check that every collection's data is reachable and that every change has a matching recalculation.

| Endpoint | users | rounds | courses | clubs |
| --- | :---: | :---: | :---: | :---: |
| POST `/api/auth/register` | C R | | C *(home course by name)* | |
| POST `/api/auth/login` | R U *(device)* | | | |
| GET `/api/users/me` | R | | R | |
| PATCH `/api/users/:userId` | R U | | R *(check home course)* | |
| DELETE `/api/users/:userId` | D | D | D | D |
| GET `/api/users/:userId/export` | R | R | R | R |
| GET `/api/rounds` | | R | | |
| POST `/api/rounds` | U *(stats snapshot, device)* | C *(R if duplicate)* | C R U *(find or create, learn holes)* | R U *(bag check, distances)* |
| GET `/api/rounds/:roundId` | | R | | |
| PATCH `/api/rounds/:roundId` | U *(snapshot)* | R U | | R U |
| DELETE `/api/rounds/:roundId` | U *(snapshot)* | D | | U |
| GET `/api/courses` | | | R | |
| GET `/api/courses/:courseId` | | | R | |
| GET `/api/stats/:userId` | R | R | | |
| GET `/api/clubs/:userId` | R *(units)* | R *(first time)* | | C *(first time)* R |
| PUT `/api/clubs/:userId` | R *(units)* | R | | U |
| GET `/api/leaderboard` | R | R *(aggregation)* | R *(home course)* | |

Every collection has at least one C, R, U and D, so its whole life cycle is covered:

| Collection | Created by | Read by | Updated by | Deleted by |
| --- | --- | --- | --- | --- |
| users | register | me, stats, leaderboard, export | PATCH user, login, every round change | DELETE user |
| rounds | POST rounds | GET rounds, stats, leaderboard, export | PATCH round | DELETE round, DELETE user |
| courses | POST rounds, register | GET courses, me, export | POST rounds (learns holes) | DELETE user |
| clubs | first GET clubs or round upload | GET clubs, export | PUT clubs, every round change | DELETE user |

## 3. Status codes and error codes (A2 Table 8)

| Code | Error code | Returned when | Example test |
| --- | --- | --- | --- |
| 200 | – | Read or update succeeded; or an app upload was a duplicate | Postman "Upload the same round again" |
| 201 | – | Account or round created, with a `Location` header | Postman "Upload a round from the app" |
| 204 | – | Delete succeeded, no body | Postman "Delete the uploaded round" |
| 400 | BAD_REQUEST | Malformed JSON, bad query (`limit=500`) or bad id | Postman "List with limit=500" |
| 401 | UNAUTHENTICATED | No, invalid or expired token; wrong email or password | Postman "No token", "Invalid token" |
| 403 | FORBIDDEN | Valid token but `:userId` is someone else | Postman "Someone else's stats" |
| 404 | NOT_FOUND | Unknown route, or a round or course that is not yours | Postman "Unknown route" |
| 409 | EMAIL_TAKEN | Registering with an email already used | Postman "Register with a used email" |
| 413 | PAYLOAD_TOO_LARGE | Body over 1 MB | – |
| 422 | VALIDATION_FAILED | Valid JSON that breaks a rule (strokes 25) | Postman "Upload a round with a bad score" |
| 429 | RATE_LIMITED | Over 20 sign-in attempts in 15 minutes from one address (600 requests for the rest of the API) | – |
| 500 | SERVER_ERROR | Unexpected failure; details only go to the log | – |
