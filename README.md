# Budget Golfers

A free golf app and website that share one database through our own REST API.

| Folder | What | Stack | Status |
| --- | --- | --- | --- |
| `app/` | Phone app: score rounds, GPS shots, club distances. No account needed; sign in only to upload. | Flutter, Mapbox, sqflite, http, flutter_secure_storage | Phase 1 + upload (Phase 2) built |
| `api/` | REST API (17 endpoints from the Assignment 2 design), the MongoDB database, seed data, tests and Postman collection | Node.js, Express 5, Mongoose, MongoDB (local or Atlas), Render | Phase 2 built and tested |
| `web/` | Single page application website on the same API, built from the Assignment 2 template (MVVM) | React, Vite, React Router, Recharts, Vercel | Phase 3 built and tested |
| `docs/json/` | The Assignment 2 JSON structures: the contract all three parts are tested against | — | — |

Ports: the API runs on **3000**, the website on **5000**.

## Run the API and database

```bash
cd api
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run seed              # 8 test golfers, 107 rounds; password for all: Correct-Horse-7
npm start                 # http://localhost:3000/api/health
npm test                  # 108 automated tests
```

See [`api/README.md`](api/README.md), the CRUD matrix in
[`api/docs/CRUD-matrix.md`](api/docs/CRUD-matrix.md), the collections and
recreate instructions in [`api/docs/database.md`](api/docs/database.md), and
the test results in [`api/docs/testing.md`](api/docs/testing.md).

## Run the website

```bash
cd web
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:3000
npm run dev               # http://localhost:5000, sign in as aroha.m@example.com / Correct-Horse-7
npm test                  # 39 tests
```

See [`web/README.md`](web/README.md) (MVVM structure, routes, AJAX components) and
[`web/docs/testing.md`](web/docs/testing.md) (tests, the end-to-end run and its screenshots).

## Online database

[`docs/connect-atlas.md`](docs/connect-atlas.md) moves the data to MongoDB Atlas: create
the free cluster, put its connection string in `api/.env`, run `npm run seed`.

## Run the app

See [`app/README.md`](app/README.md). On the Android emulator the app uploads
to `http://10.0.2.2:3000` (the API on your computer) by default.

## Changes to the Assignment 2 design

Courses are self-named by golfers (many municipal courses aren't in any course
database), so `POST /api/rounds` takes `course: { name }` instead of
`courseId`, and the API finds or creates that golfer's course. The other
small changes that follow from it are listed in `api/docs/database.md`. New
request examples are in `docs/json/api/` (`*_v2_*.json`).
