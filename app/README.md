# Budget Golfers — phone app

Flutter app for Android (iPhone-ready packages, built later). It records a round
with **no account**: self-named course, scores, GPS shots on a Mapbox satellite
map, landing tags, club averages and club suggestions. Every finished round is
stored on the phone. When the golfer signs in, finished rounds upload to the
Budget Golfers API (`POST /api/rounds`) and appear on the website.

## Run it

1. **Mapbox token and API address.** Copy `config/mapbox.example.json` to
   `config/mapbox.json` and paste your **public** token (`pk.…`). Set
   `API_BASE_URL` to the API (see "Sign in and upload" below). The `MAPBOX_ACCESS_TOKEN` in the
   old project's `flutter.env` is a public token and works here. No secret
   (`sk.…`) token is needed since mapbox_maps_flutter 2.5.1, so don't add one.
   `config/mapbox.json` is git-ignored.
2. **Packages and tests**
   ```
   flutter pub get
   flutter analyze
   flutter test
   ```
3. **Run on a phone or emulator**
   ```
   flutter run --dart-define-from-file=config/mapbox.json
   ```
   In VS Code, **Run > Start Debugging** uses `.vscode/launch.json`, which
   already passes that flag. Without a token the app still scores rounds; the
   map shows a message instead.

The first build creates `android/local.properties`, `gradlew` and the Gradle
wrapper jar for you. If Gradle complains about the Java version, either run
`flutter config --jdk-dir <path to JDK 17>` or add the
`org.gradle.java.home=...` line from the old project's
`android/gradle.properties` (that file is machine-specific, so it isn't
committed here).

The app id is `com.jooblian.golfapp`, the same as the old app, so installing
this version replaces it. Theme and unit settings carry over.

**iPhone later:** on a Mac, run
`flutter create --platforms=ios --org com.jooblian --project-name golfapp .`
to add the `ios/` folder (it won't touch `lib/`), then add the location usage
text to `ios/Runner/Info.plist`.

## Sign in and upload

No account is needed to play. A golfer signs in only when they want their
rounds on the website: from the **Upload to the website** card on the home
screen, the upload button in Past Rounds, a round's upload banner, or
Settings > Account.

- **Where it uploads.** `API_BASE_URL` in `config/mapbox.json`; it can also be
  changed in Settings > Account > Server, with a **Check** button.
  - Android emulator with the API on the same computer: `http://10.0.2.2:3000`
    (the default).
  - A phone on the same Wi-Fi: `http://<your computer's IP>:3000`, and allow
    Node.js through the Windows firewall when asked.
  - The hosted API: its `https://` address. Release builds only allow https;
    debug builds also allow plain http (see `android/app/src/debug/AndroidManifest.xml`).
- **Sign-in.** `POST /api/auth/login` (or register) with `client: "mobile-app"`,
  so the token lasts 30 days. It is kept in the Android Keystore through
  `flutter_secure_storage`. Signing out keeps every round on the phone.
- **The queue.** Finished rounds wait as *pending*. They upload one at a time,
  oldest first, when a round is finished, when the app opens or comes back to
  the front, when the phone gets a connection (`connectivity_plus`), and from
  **Upload now**. The bag is sent once with `PUT /api/clubs/:userId` first,
  and again whenever it changes.
- **Another account.** Rounds finished while signed out go to whoever signs
  in next. If that is a different account from the last one on this phone,
  the app asks first; "No" keeps them for the other account.
- **Replies.** 201 or 200 (already uploaded) → *uploaded*. Retrying is always
  safe: the server matches the round's `clientRoundId`. 422 → *failed*, with
  the reason shown on the round and a **Try again** button; the next round
  still goes. 401 → the sign-in has expired; the app asks for it again. No
  connection, 429 or 5xx → the rounds stay queued for later.

## How it's organised

```
lib/
  main.dart            Mapbox token, database, settings, account, runApp, auto upload
  app.dart             MaterialApp, AppScope (settings for every screen)
  config.dart          MAPBOX_ACCESS_TOKEN and API_BASE_URL from --dart-define-from-file
  services.dart        The account and upload queue, plus the resume/connectivity triggers
  theme.dart           Web palette (Bottle Green, Fairway Dark, Turquoise, Light Cyan, Sand, Flag Red), Poppins + Nunito
  models/
    geo.dart           LatLng, haversine, left/right bias, long/short miss
    shot.dart          Shot: start, target, landing, club, result; accuracy %
    hole.dart          HoleScore: shots + putts + penalties = strokes; Undo; fairway/GIR
    round.dart         Round, RoundTotals, sync status, toApiJson() = POST /api/rounds body
    clubs.dart         API club codes, name clean-up, BagClub
    club_stats.dart    Per-club averages (5-shot minimum, chips under 30 m left out), club suggestion
  data/
    app_database.dart  sqflite: rounds, courses (self-named + pars), bag
    round_repository.dart, course_repository.dart, bag_repository.dart
    settings_controller.dart  theme, units, current club (shared_preferences)
    api_client.dart    HTTP calls to the API and its JSON error format
    account_controller.dart   sign-in, token in secure storage, device id, server address
    upload_service.dart       the upload queue and how each reply is handled
  screens/
    home, new_round, scoring, map, rounds, round_detail, round_map,
    profile (Clubs / Performance / Accuracy), settings, help, sign_in
  widgets/
    scorecard, score_mark, stat_tile, club_picker, pin_images, upload_card
  util/
    format.dart, location.dart
test/
  geo_test.dart, round_test.dart, clubs_test.dart, widget_test.dart
  upload_test.dart     sign-in and every upload reply, against a fake API
  fixtures/            Assignment 2 JSON the upload body is tested against
```

## Ported from the old app

| Old `lib/main.dart` | New home |
| --- | --- |
| `ShotEvent` maths (haversine, accuracy %, bias, lateral/forward miss) | `models/geo.dart`, `models/shot.dart` |
| `MapPage` (red target pin, orange ball pin, drag events, zoom, recentre) | `screens/map_screen.dart`, `widgets/pin_images.dart` (now satellite) |
| `RoundShotsMapPage` | `screens/round_map_screen.dart` (plus a hole filter) |
| `ClubAnalytics`, `ClubSummary` | `models/club_stats.dart` |
| `_canon`, `_suggestClubByAvgs` | `Clubs.canonicalise`, `ClubStats.suggest` (API codes) |
| `DraftRoundStore` autosave | `RoundRepository.save` after every press |
| `ParStore` | `CourseRepository` (pars per self-named course) |
| `NewRoundPage`, `ScoreCardNine` | `screens/scoring_screen.dart`, `widgets/scorecard.dart` |
| Home cards, Profile tabs, Settings, Help | same screens, rewritten |
| Firebase | removed (it never stored data) |

## Upload contract

`Round.toApiJson()` produces the Assignment 2 `rounds_create_request.json`
body with one change: `course: { "name": "…" }` replaces `courseId`, because
golfers name their own courses. The API finds or creates that golfer's course
from the name. Round detail > menu > **Copy upload JSON** puts it on the
clipboard for testing the API in Postman.

**Try it end to end:** start the API (`cd ../api && npm run seed && npm start`),
run the app on the emulator, finish a round, tap **Sign in to upload** and
sign in as `aroha.m@example.com` / `Correct-Horse-7`. The round shows a green
cloud, and `GET /api/rounds` (or the website) lists it.
