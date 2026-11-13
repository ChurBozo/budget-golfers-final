# Budget Golfers website

The Budget Golfers web dashboard: a React single page application built from the Assignment 2 design and HTML/CSS template. It reads everything from the Budget Golfers API, the same API the phone app uploads rounds to.

- React 18, React Router 6 (client-side routes), Recharts (score trend), built with Vite.
- Runs on **port 5000**; the API runs on 3000.
- Pattern: **MVVM**. Views and components, custom hooks as view models, and a service layer as the model.

## Quick start

Start the API first (see `../api/README.md`: `npm run seed`, then `npm start`). Then:

```bash
cd web
npm install
cp .env.example .env      # Windows: copy .env.example .env   (VITE_API_URL=http://localhost:3000)
npm run dev               # http://localhost:5000
```

Sign in with `aroha.m@example.com` / `Correct-Horse-7`. The other test accounts are listed in `../api/docs/database.md`.

**Global npm modules:** none. Vite and Vitest are installed locally by `npm install`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on port 5000 |
| `npm run build` | Production build into `dist/` (each view is its own lazy-loaded chunk) |
| `npm run preview` | Serves the production build on port 5000 |
| `npm test` | 39 Vitest + Testing Library tests (no API needed) |
| `npm run test:e2e` | End-to-end browser test against the running API and website (needs Playwright, see `docs/testing.md`) |

## Design pattern: MVVM

```
View (views/, components/)  ──props/events──▶  ViewModel (hooks/)  ──calls──▶  Model (services/, context/)  ──fetch──▶  REST API
```

```
web/
├── index.html                 the template's page shell and its SVG icon sprite
├── vite.config.js             port 5000, test settings
├── vercel.json                every path rewrites to index.html (deep links)
└── src/
    ├── main.jsx               fonts, the template CSS, <App/>
    ├── App.jsx                the route table (A2 Table 4); views lazy-loaded
    ├── services/              MODEL: one module per resource
    │   ├── apiClient.js       fetch() wrapper: Bearer token, response.ok check, envelope
    │   │                      unwrap, one ApiError type, 401 signs out
    │   ├── authService.js, usersService.js, roundsService.js, coursesService.js,
    │   │   statsService.js, clubsService.js, leaderboardService.js
    │   └── cache.js           last response per request for the session
    ├── context/               MODEL (shared state)
    │   ├── AuthContext.jsx    user + token (memory, with a sessionStorage copy)
    │   └── PreferencesContext.jsx   units, theme, leaderboard opt-in (optimistic PATCH)
    ├── hooks/                 VIEWMODEL: request state (data, loading, error), derived
    │   │                      values with useMemo (units, nines, chart order), actions
    │   ├── useResource.js     shared base: cache, AbortController, reload
    │   ├── useStats.js, useRounds.js (useRounds, useRound), useCourses.js,
    │   │   useClubs.js, useLeaderboard.js, useProfile.js (useProfile, useExport)
    │   └── usePageTitle.js    document title and focus on the view heading
    ├── components/            VIEW: presentational; props in, events out, never fetch
    │   ├── layout/            AppShell (sidebar, top bar, footer), ProtectedRoute
    │   ├── StatCard, ScoreTrendChart, AccuracyCard, RoundList, Scorecard (with
    │   │   ShotList), Clubs (ClubBars, ClubTable), LeaderboardTable,
    │   │   Controls (Chips, FilterBar, Pagination), Common (Icon, Skeleton,
    │   │   ErrorState, EmptyState, Notice, ConfirmDialog, ApiTag)
    ├── views/                 VIEW (route components): compose components, call hooks
    │   └── AuthView, DashboardView, RoundsView, RoundDetailView, ClubsView,
    │       LeaderboardView, SettingsView, NotFoundView
    ├── styles/
    │   ├── styles.css         the Assignment 2 template stylesheet, unchanged
    │   └── app.css            the few rules React needs (see below)
    ├── assets/                template SVGs: logo, wordmarks, fairway pattern, sprite
    └── utils/                 format.js (dates, to-par, metres/yards), clubs.js
```

Only `services/` calls `fetch`, only hooks call services, and components only receive props. That is what makes the components easy to test (`tests/components.test.jsx`) and lets two views share a hook.

## How the template became the app

`src/styles/styles.css` is the Assignment 2 stylesheet byte for byte, and the views use its markup and class names (`.card`, `.stat-value`, `.round-item`, `.scorecard`, `.bars`, `.chips`, `.state-empty` and so on). The template switched views with `:target`, so `app.css` adds only:

- `.view { display: block }` and `.auth { display: grid }`: React Router now decides which view is shown;
- `.nav a.active`: NavLink's active class replaces the `:target` highlight;
- styles for things the template did not draw: the confirm dialog, the shot list, the 404 page.

Two template features work unchanged:

- **Dark theme.** The template keys it on `body:has(#theme-toggle:checked)`. The real ThemeToggle has that id, and the theme is saved on the account.
- **API annotations.** "Show API annotations" in the footer outlines every AJAX component and shows the request that fills it, as in the template's design review.

## Routes (A2 Table 4)

| Route | View | Access | Requests on load |
| --- | --- | --- | --- |
| `/login`, `/register` | AuthView | Public | none until submit: `POST /api/auth/login` or `/register` |
| `/` | redirect to `/dashboard` | Private | – |
| `/dashboard?period=` | DashboardView | Private | `GET /api/stats/:userId?period=`, `GET /api/rounds?limit=3&sort=-playedAt` |
| `/rounds?from=&to=&courseId=&holes=&page=` | RoundsView | Private | `GET /api/rounds?…`, `GET /api/courses` (cached) |
| `/rounds/:roundId` | RoundDetailView | Private | `GET /api/rounds/:roundId` |
| `/clubs` | ClubsView | Private | `GET /api/clubs/:userId` |
| `/leaderboard?sort=&period=` | LeaderboardView | Private | `GET /api/leaderboard?…` |
| `/settings` | SettingsView | Private | `GET /api/users/me` (AuthContext), `GET /api/courses` |
| `*` | NotFoundView | Public | – |

Filters, page, period and sort are kept in the URL, so Back and Forward step through them and any view can be bookmarked.

## AJAX components (A2 Table 5)

Every component has the four designed states: a loading skeleton, the data, an empty state saying what to do next, and an error with Retry.

| Component | Hook (view model) | Request | File |
| --- | --- | --- | --- |
| LoginForm / RegisterForm | AuthContext | `POST /api/auth/login`, `/register` | `views/AuthView.jsx` |
| UserChip | AuthContext | `GET /api/users/me` | `components/layout/AppShell.jsx` |
| UnitToggle, ThemeToggle | PreferencesContext | `PATCH /api/users/:userId` (optimistic, rolled back on failure) | `components/layout/AppShell.jsx` |
| StatCards, ScoreTrendChart, AccuracyCard | `useStats(period)` | `GET /api/stats/:userId?period=` (one request for all three) | `views/DashboardView.jsx` |
| RecentRounds | `useRounds({ limit: 3 })` | `GET /api/rounds?limit=3&sort=-playedAt` | `views/DashboardView.jsx` |
| FilterBar | `useCourses()` | `GET /api/courses` | `components/Controls.jsx` |
| RoundList | `useRounds(filters)` | `GET /api/rounds?from=&to=&courseId=&holes=&page=&limit=10` | `views/RoundsView.jsx` |
| RoundSummary, Scorecard, ShotList | `useRound(id)` | `GET /api/rounds/:roundId` | `views/RoundDetailView.jsx` |
| DeleteRoundButton | `useRound(id).deleteRound` | `DELETE /api/rounds/:roundId` | `views/RoundDetailView.jsx` |
| ClubDistanceChart, ClubTable | `useClubs()` | `GET /api/clubs/:userId` | `views/ClubsView.jsx` |
| LeaderboardTable, SortTabs | `useLeaderboard({ sort, period })` | `GET /api/leaderboard?sort=&period=&page=` | `views/LeaderboardView.jsx` |
| ProfileForm, Preferences | `useProfile()`, PreferencesContext | `PATCH /api/users/:userId` | `views/SettingsView.jsx` |
| DataExport | `useExport()` | `GET /api/users/:userId/export?format=` (saved as a file) | `views/SettingsView.jsx` |
| DeleteAccount | `useProfile().deleteAccount` | `DELETE /api/users/:userId` (typed confirmation) | `views/SettingsView.jsx` |

## Tokens, caching and cancelling (A2 section 5.7)

- The token is held in memory and copied to sessionStorage, so a refresh keeps the session and closing the tab ends it. When it expires, or the API answers 401, the golfer is signed out and sent to `/login`; after signing in they return to the page they asked for.
- Each hook shows the last response for its request at once while a fresh copy loads. Deleting a round clears the cached rounds, stats, clubs and leaderboard.
- When filters change quickly or the golfer leaves a view, the older request is cancelled with an AbortController.

## Deploying to Vercel

1. Import the repository in Vercel with root directory `web`. The build command is `npm run build` and the output is `dist`.
2. Set `VITE_API_URL` to the API's Render address. Vite bakes it in at build time, so redeploy after changing it.
3. `vercel.json` rewrites every path to `index.html`, so deep links work.
4. Add the Vercel address to the API's `CORS_ORIGINS` on Render.
