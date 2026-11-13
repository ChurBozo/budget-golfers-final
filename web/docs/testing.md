# Testing: Budget Golfers website

| Test | Tool | Result | Output |
| --- | --- | --- | --- |
| Unit, component and view tests | Vitest + Testing Library (jsdom) | **39 passed, 0 failed** (4 files) | `test-results/vitest-output.txt` |
| End-to-end: a real browser against the real website, API and MongoDB | Playwright (Chromium) | **24 checks passed, 0 failed** | `test-results/e2e-output.txt`, `e2e-results.json`, `screenshots/` |

Both were run on 5 November 2026, with the seed data loaded in MongoDB 8.3, the API on port 3000 and the website on port 5000.

## 1. Vitest (`npm test`)

These need no server: the view tests replace the service layer (the model) with mocks, so they check that each view and hook asks for the right data and shows the designed states.

| File | What it proves |
| --- | --- |
| `tests/format.test.js` | Score to par, signed changes, metres to yards, scorecard classes, initials, club names |
| `tests/apiClient.test.js` | The token and query are sent; the envelope is unwrapped; API errors become one ApiError with field errors; a 401 signs out (but not on the sign-in request); network errors, 204 and non-JSON 5xx replies; aborted requests |
| `tests/components.test.jsx` | Scorecard marks and Out/In/Total; the leaderboard highlights your row; round rows link to the detail view; stat card wording; club bars in yards; error Retry; 404 hides details; confirm dialog focus and Escape; pagination |
| `tests/views.test.jsx` | Guarded routes redirect to `/login`; sign-in validation, the 401 and 409 messages, and returning to the page you asked for; the 404 view; the dashboard's one stats request, period chips in the URL, error and Retry; round filters in the URL and the request; empty states; round detail and delete with confirmation; optimistic units with rollback; clubs with too few shots; leaderboard sort; a 422 beside the field; deleting the account needs DELETE typed |

## 2. End-to-end (`npm run test:e2e`)

Start the API with the seed data and the website first, then install Playwright once:

```bash
npm i -D playwright && npx playwright install chromium
npm run test:e2e
```

The run registers a new golfer, uploads five rounds in the phone app's exact format, and uses every view. It deletes a round and finally deletes the account, so the seed data stays the same. It then signs in as the seeded golfers to capture each view.

| # | Check |
| --- | --- |
| 1 | A private page without a session redirects to `/login` |
| 2 | A wrong password shows the API's 401 message under the field |
| 3 | Register checks the fields in the browser first |
| 4 | Registering signs the new golfer in to an empty dashboard |
| 5 | Rounds uploaded in the app's format appear after a refresh |
| 6 | Period chips change the URL and the numbers |
| 7 | Round filters live in the URL (Back undoes a filter) |
| 8 | Round detail shows the scorecard and the expandable shot list |
| 9 | Deleting a round asks first, then returns to the list |
| 10 | Yards are saved on the account and used on the scorecard |
| 11 | A deep link in a new tab asks for sign-in, then opens that round |
| 12 | Export downloads a CSV file with the API's file name |
| 13 | Deleting the account needs DELETE typed, then signs out, and the account can no longer sign in |
| 14–21 | Seeded golfer: dashboard, API annotations, rounds, the A2 example round, clubs, leaderboard (own row, sort, period, opted-out golfer hidden), settings, 404 |
| 22 | Dark theme, saved on the account |
| 23 | Phone layout: the sidebar becomes a bottom tab bar under 760 px |
| 24 | No JavaScript errors in the browser console |

Two real bugs were found and fixed by these tests:

- The confirm dialog pulled focus back to Cancel on every keystroke, so DELETE could not be typed.
- The API did not expose the `Content-Disposition` header to the browser, so exports lost their file name.

### Screenshots (`test-results/screenshots/`)

`01-login`, `02-login-error`, `03-register-validation`, `04-dashboard-empty`, `05-delete-round-dialog`, `06-delete-account-dialog`, `07-dashboard`, `08-dashboard-api-annotations`, `09-rounds`, `10-round-detail`, `11-round-detail-shots`, `12-clubs`, `13-leaderboard`, `14-settings`, `15-not-found`, `16-dashboard-dark`, `17-leaderboard-dark`, `18-phone-dashboard`, `19-phone-rounds`.
