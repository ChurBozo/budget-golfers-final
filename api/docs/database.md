# Database: Budget Golfers (MongoDB)

The API stores its data in one MongoDB database, `budget_golfers`, with four collections. Each collection has a Mongoose schema in `src/models/`, which defines the fields, the validation rules (A2 Table 10) and the indexes (A2 Table 11). Only the model layer talks to MongoDB.

```
users  1 ──< rounds        a golfer has many rounds          rounds.userId  → users._id
users  1 ──< courses       a golfer has their own courses     courses.createdBy → users._id
courses 1 ──< rounds       a round is played on one course    rounds.course.courseId → courses._id
users  1 ─── 1 clubs       a golfer has one bag               clubs.userId → users._id
users  0..1 ── courses     a golfer may pick a home course    users.homeCourseId → courses._id
```

## Why the data is shaped this way

The design follows how the website and app read the data (MongoDB, n.d.-a):

- **Holes and shots are embedded in the round.** They are always read together with their round and never on their own, and a round has at most 18 holes. Embedding means the round detail page needs one read, and an uploaded round is saved in one atomic write.
- **Rounds are a separate collection, referenced by `userId`.** A golfer's rounds keep growing, and the dashboard lists them in pages, so they are not embedded in the user.
- **The course name and par are copied into each round** (`rounds.course`). The rounds list shows the course name without a second query, and the round keeps the course name it was played under.
- **`users.statsSnapshot` holds a small summary** (rounds played, recent average, best score, handicap estimate). It is recalculated after every round change, so the user chip and the leaderboard index do not have to add up every round.
- **Club distances are stored in `clubs`** and recalculated after every round change, so the Clubs page is a single read.
- **Totals and distances are always calculated by the server.** A client never sends totals or club averages. Shot distances are measured from the GPS points.

## Changes since the Assignment 2 design

| Change | Why |
| --- | --- |
| Courses are **self-named and belong to one golfer** (`createdBy` is required). The unique index is now `{ createdBy, slug }` instead of `{ slug }`. `GET /api/courses` lists the caller's own courses. | Many municipal and small courses are not in any course list and have no map location. The golfer types the course name in the app; the API finds or creates that golfer's course from its slug, so "Omanu golf club" and "OMANU GOLF CLUB" are the same course. |
| `POST /api/rounds` accepts `course: { name }` as well as `courseId`. | The app does not know server course ids; it knows the name the golfer typed. |
| `location`, `tees` and `strokeIndex` are optional on courses. A course learns its holes (par and length per tee) from the rounds played on it. | A self-named course starts with only a name. |
| `register` takes an optional `homeCourseName` instead of `homeCourseId`. | A new golfer has no courses yet. |
| Login and register accept `client: "mobile-app"` and a `device`. The app's token lasts 30 days; the website's still lasts 1 hour. | The app uploads in the background and should not ask the golfer to sign in every hour. |
| Shots shorter than 30 m do not count towards club averages. | Chips say nothing about how far a club goes with a full swing. |

## Collections

### users

One document per golfer.

| Field | Type | Rules |
| --- | --- | --- |
| `_id` | ObjectId | |
| `email` | string | required, unique, stored in lower case, valid email |
| `passwordHash` | string | bcrypt hash (cost 12); never returned by the API |
| `displayName` | string | 2–30 characters |
| `role` | string | `golfer` or `admin`; clients cannot set it |
| `homeCourseId` | ObjectId → courses | optional; must be one of the golfer's own courses |
| `preferences.units` | string | `metric` or `imperial` |
| `preferences.theme` | string | `light` or `dark` |
| `preferences.showOnLeaderboard` | boolean | default `true`; `false` hides the golfer from the leaderboard |
| `statsSnapshot` | object | `roundsPlayed`, `averageScoreLast20`, `averageScorePrev20`, `bestScore`, `handicapEstimate`, `lastRoundAt` (server only) |
| `devices[]` | array | up to 5 `{ deviceId, platform, lastSyncAt }` (phones that upload rounds) |
| `createdAt`, `updatedAt` | Date | set by Mongoose |

Indexes: `{ email: 1 }` unique; `{ "preferences.showOnLeaderboard": 1, "statsSnapshot.averageScoreLast20": 1 }`.

### rounds

One document per round, with its holes and shots embedded.

| Field | Type | Rules |
| --- | --- | --- |
| `userId` | ObjectId → users | required |
| `clientRoundId` | string | UUID made by the app; unique per golfer, so a repeated upload is not stored twice |
| `source` | string | `mobile-app` or `web` |
| `course` | object | `{ courseId → courses, name, par }` (par of the holes played) |
| `tee` | string | optional, e.g. `Yellow` |
| `playedAt` | Date | required, not in the future |
| `holesPlayed` | number | 9 or 18, equal to `holes.length` |
| `totals` | object | `strokes`, `toPar`, `putts`, `penalties`, `fairwaysHit`, `fairwaysPossible`, `greensInRegulation` (server only) |
| `holes[]` | array | `number` 1–18 (no repeats), `par` 3–6, `distanceMetres`, `strokes` 1–20, `putts` 0–strokes, `penalties`, `teeClub`, `fairwayHit` (par 4 and 5 only), `greenInRegulation`, `shots[]` |
| `holes[].shots[]` | array | `seq`, `club`, `start` and `end` as GeoJSON points `[lng, lat]`, `distanceMetres` (measured), `result` (`fairway`, `rough-left`, `rough-right`, `bunker`, `green`, `penalty`) |
| `notes` | string | up to 500 characters |

Indexes: `{ userId: 1, playedAt: -1 }` (a golfer's rounds, newest first); `{ userId: 1, "course.courseId": 1, playedAt: -1 }` (course filter); `{ userId: 1, clientRoundId: 1 }` unique and partial (only when `clientRoundId` is a string); `{ holesPlayed: 1, playedAt: -1 }` (leaderboard aggregation).

### courses

One document per course per golfer.

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | 2–80 characters, as the golfer typed it |
| `slug` | string | lower-case, accents removed (`Pāpāmoa Muni 9` → `papamoa-muni-9`); unique per golfer |
| `region` | string | optional |
| `location` | GeoJSON point | optional |
| `tees[]` | array | `name`, `par`, `totalMetres`, `courseRating`, `slopeRating` (all optional except the name) |
| `holes[]` | array | `number`, `par`, `strokeIndex`, `metres` (a map of tee name → metres) |
| `createdBy` | ObjectId → users | required |

Indexes: `{ createdBy: 1, slug: 1 }` unique; `{ name: "text" }`; `{ location: "2dsphere" }` (documents with no location are skipped by this index).

### clubs

One document per golfer: their bag and the distance statistics for each club.

| Field | Type | Rules |
| --- | --- | --- |
| `userId` | ObjectId → users | required, unique |
| `clubs[]` | array | `code` (e.g. `7i`), `label`, `inBag`, `stats` |
| `clubs[].stats` | object | `shotCount`, `averageMetres`, `longestMetres`, `spreadMetres` (null until the club has 5 measured shots) |
| `recalculatedAt` | Date | when the stats were last worked out |

Rules: at most 14 clubs with `inBag: true`; codes cannot repeat; a custom club needs a label. Index: `{ userId: 1 }` unique.

## Test data

`seed/data/` holds one JSON file per collection, in MongoDB Extended JSON (so ids and dates keep their types). The files are produced by `seed/generate.js`, which uses the API's own calculation code, so every stored total, snapshot and club average is exactly what the API would have calculated (this is checked by `tests/integration/seed.test.js`).

| File | Documents | Contents |
| --- | --- | --- |
| `users.json` | 8 | Seven golfers with different abilities and settings, and one brand new account with no rounds |
| `courses.json` | 15 | Each golfer's own courses: Omanu (with location, tees and ratings), Tauranga, Mount Maunganui, and a self-named 9-hole muni with no location |
| `rounds.json` | 107 | Rounds from November 2025 to November 2026, 9 and 18 holes, most with GPS shots, a few typed in on the website |
| `clubs.json` | 7 | Each golfer's bag with calculated distances |

The two example rounds from the A2 design are included with their design ids: `66f2c9e0b1a2c3d4e5f60718` (Omanu, 12 September 2026, 84, Aroha's personal best, "Windy back nine") and `66ea41b7b1a2c3d4e5f60611` (Tauranga, 6 September 2026, 89).

### Test accounts

Every account has the password **`Correct-Horse-7`**.

| Email | Name | Rounds | What it shows |
| --- | --- | --- | --- |
| `aroha.m@example.com` | Aroha M. | 32 | Main test account (the A2 example golfer): full dashboard, GPS shots, a 4 iron with too few shots |
| `tane.w@example.com` | Tane W. | 24 | Low scorer, dark theme, plays the White tees |
| `mei.l@example.com` | Mei L. | 18 | Improving quickly; plays Omanu and the Mount |
| `sam.k@example.com` | Sam K. | 9 | Beginner, some 9-hole rounds |
| `priya.r@example.com` | Priya R. | 12 | Imperial units (yards), dark theme |
| `hemi.t@example.com` | Hemi T. | 10 | Opted out of the leaderboard |
| `lucy.b@example.com` | Lucy B. | 2 | Below the 3-round leaderboard minimum |
| `new.golfer@example.com` | New Golfer | 0 | Empty states on every page |

No database user is needed for a local MongoDB. For Atlas, the connection string's user and password go in `MONGODB_URI` in `.env`.

## How to recreate the database

**Option A: the seed script (recommended).** It drops and reloads the four collections and builds every index.

```bash
cd api
npm install
cp .env.example .env          # Windows: copy .env.example .env
# set MONGODB_URI in .env if you are not using a local MongoDB on port 27017
npm run seed
```

When marking long after November 2026, `npm run seed -- --relative` moves every date forward so the newest round was played two days ago. Without it, the "this season" and "last 30 days" leaderboards will be empty in a later year.

**Option B: mongoimport (MongoDB Database Tools).**

```bash
cd api/seed/data
mongoimport --uri "mongodb://127.0.0.1:27017/budget_golfers" --collection users   --file users.json   --jsonArray --drop
mongoimport --uri "mongodb://127.0.0.1:27017/budget_golfers" --collection courses --file courses.json --jsonArray --drop
mongoimport --uri "mongodb://127.0.0.1:27017/budget_golfers" --collection rounds  --file rounds.json  --jsonArray --drop
mongoimport --uri "mongodb://127.0.0.1:27017/budget_golfers" --collection clubs   --file clubs.json   --jsonArray --drop
```

The indexes are created by the API the first time it starts (`npm start`).

**Option C: MongoDB Compass.** Create the database `budget_golfers`, then for each collection choose *Add Data → Import JSON or CSV file* and pick the matching file. Start the API to build the indexes.

**Check it worked:** `mongosh "mongodb://127.0.0.1:27017/budget_golfers" seed/check-database.mongosh.js` prints the collections, counts, indexes and sample queries (saved output: `docs/test-results/database-check.txt`).

## References

MongoDB. (n.d.-a). *Data modeling*. MongoDB Database Manual. Retrieved November 5, 2026, from https://www.mongodb.com/docs/manual/data-modeling/

MongoDB. (n.d.-b). *mongoimport*. MongoDB Database Tools. Retrieved November 5, 2026, from https://www.mongodb.com/docs/database-tools/mongoimport/

Mongoose. (n.d.). *Schemas*. Retrieved November 5, 2026, from https://mongoosejs.com/docs/guide.html
