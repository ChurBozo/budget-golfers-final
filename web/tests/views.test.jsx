// Views with their hooks (view models) and contexts, with the service layer
// (the model) mocked. This checks each AJAX component asks for the right data
// and shows the designed states.
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { PreferencesProvider } from '../src/context/PreferencesContext';
import { AppRoutes } from '../src/App';
import { ApiError } from '../src/services/apiClient';
import { clearCache } from '../src/services/cache';
import * as authService from '../src/services/authService';
import * as usersService from '../src/services/usersService';
import * as statsService from '../src/services/statsService';
import * as roundsService from '../src/services/roundsService';
import * as coursesService from '../src/services/coursesService';
import * as clubsService from '../src/services/clubsService';
import * as leaderboardService from '../src/services/leaderboardService';

vi.mock('../src/services/authService');
vi.mock('../src/services/usersService');
vi.mock('../src/services/statsService');
vi.mock('../src/services/roundsService');
vi.mock('../src/services/coursesService');
vi.mock('../src/services/clubsService');
vi.mock('../src/services/leaderboardService');

const COURSE_ID = '66e9b7d1a2c3d4e5f6a7b8c9';

const USER = {
  id: '66f0a1c2e4b0a1b2c3d4e5f6',
  email: 'aroha.m@example.com',
  displayName: 'Aroha M.',
  homeCourse: { id: 'c1', name: 'Omanu Golf Club' },
  handicapEstimate: 18.4,
  preferences: { units: 'metric', theme: 'light', showOnLeaderboard: true },
};

const ROUND_SUMMARY = {
  id: '66f2c9e0b1a2c3d4e5f60718',
  playedAt: '2026-09-12T02:10:00.000Z',
  course: { id: 'c1', name: 'Omanu Golf Club' },
  tee: 'Yellow',
  holesPlayed: 18,
  totals: { strokes: 84, toPar: 12, putts: 31, fairwaysHit: 9, fairwaysPossible: 14, greensInRegulation: 5 },
  isPersonalBest: true,
};

const STATS = {
  userId: USER.id,
  period: 'last20',
  roundsInPeriod: 20,
  roundsAllTime: 37,
  scoring: { averageScore: 91.4, averageToPar: 19.2, bestScore: 84, bestRoundId: ROUND_SUMMARY.id, changeVsPreviousPeriod: -2.1 },
  putting: { puttsPerRound: 34.2, threePuttsPerRound: 2.6, changeVsPreviousPeriod: -0.8 },
  accuracy: { fairwaysHitPct: 48, greensInRegulationPct: 22, teeShotsOnTargetPct: 58, commonMiss: { direction: 'left', club: '7i' } },
  scoreDistribution: { birdieOrBetter: 3, par: 52, bogey: 181, doubleOrWorse: 124 },
  trend: [
    { roundId: 'b', playedAt: '2026-09-12', score: 84, rollingAverage: 86.5 },
    { roundId: 'a', playedAt: '2026-09-06', score: 89, rollingAverage: 89 },
  ],
  handicapEstimate: 18.4,
  calculatedAt: '2026-09-12T04:41:03.000Z',
};

function Where() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderApp(path, { signedIn = true } = {}) {
  if (signedIn) {
    sessionStorage.setItem('bg.session', JSON.stringify({ token: 't', expiresAt: Date.now() + 3600e3, user: USER }));
  }
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <PreferencesProvider>
          <AppRoutes />
          <Where />
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId('location').textContent;

beforeEach(() => {
  vi.resetAllMocks();
  clearCache();
  usersService.me.mockResolvedValue(USER);
  statsService.get.mockResolvedValue(STATS);
  roundsService.list.mockResolvedValue({
    data: [ROUND_SUMMARY],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1, filters: {}, sort: '-playedAt' },
  });
  coursesService.list.mockResolvedValue({ data: [{ id: COURSE_ID, name: 'Omanu Golf Club', region: null, holes: 18, par: 72 }], meta: { total: 1 } });
});

describe('routing and sign-in', () => {
  test('a private route without a session goes to /login', async () => {
    renderApp('/rounds', { signedIn: false });
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(location()).toBe('/login');
  });

  test('client-side checks run before anything is sent', async () => {
    renderApp('/login', { signedIn: false });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(authService.login).not.toHaveBeenCalled();
  });

  test('a 401 is shown under the password field', async () => {
    authService.login.mockRejectedValue(new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Email or password is incorrect.' }));
    renderApp('/login', { signedIn: false });
    await userEvent.type(screen.getByLabelText('Email'), 'aroha.m@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveClass('invalid');
  });

  test('signing in returns the golfer to the page they asked for', async () => {
    authService.login.mockResolvedValue({ token: 't', expiresIn: 3600, user: USER });
    renderApp('/rounds', { signedIn: false });
    await userEvent.type(await screen.findByLabelText('Email'), 'aroha.m@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Correct-Horse-7');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Round history' })).toBeInTheDocument();
    expect(location()).toBe('/rounds');
    expect(authService.login).toHaveBeenCalledWith(expect.objectContaining({ email: 'aroha.m@example.com' }));
  });

  test('registering with a used email shows the 409 under the email field', async () => {
    authService.register.mockRejectedValue(new ApiError({ status: 409, code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' }));
    renderApp('/register', { signedIn: false });
    await userEvent.type(screen.getByLabelText('Display name'), 'Aroha M.');
    await userEvent.type(screen.getByLabelText('Email'), 'aroha.m@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Correct-Horse-7');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
  });

  test('an unknown address shows the 404 view', async () => {
    renderApp('/no/such/page');
    expect(await screen.findByRole('heading', { name: /isn.t on the card/ })).toBeInTheDocument();
  });
});

describe('dashboard', () => {
  test('one stats request fills the cards, the user chip shows the handicap', async () => {
    renderApp('/dashboard');
    expect(await screen.findByText('91.4')).toBeInTheDocument();
    expect(screen.getByText('▼ 2.1 vs previous 20')).toHaveClass('trend', 'up');
    expect(screen.getByText('34.2')).toBeInTheDocument();
    expect(screen.getByText('HCP 18.4')).toBeInTheDocument();
    expect(screen.getByText(/of tee shots on target/)).toBeInTheDocument();
    expect(statsService.get).toHaveBeenCalledWith(USER.id, 'last20', expect.anything());
    expect(roundsService.list).toHaveBeenCalledWith({ limit: 3, sort: '-playedAt' }, expect.anything());
    expect(await screen.findByRole('link', { name: /Omanu Golf Club/ })).toHaveAttribute('href', `/rounds/${ROUND_SUMMARY.id}`);
  });

  test('a period chip changes the URL and asks for that period', async () => {
    renderApp('/dashboard');
    await screen.findByText('91.4');
    await userEvent.click(screen.getByRole('link', { name: 'Last 5' }));
    await waitFor(() => expect(statsService.get).toHaveBeenCalledWith(USER.id, 'last5', expect.anything()));
    expect(location()).toBe('/dashboard?period=last5');
  });

  test('an error shows Retry, and Retry asks again', async () => {
    statsService.get.mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK', message: "Couldn't reach the server." }));
    renderApp('/dashboard');
    expect(await screen.findByText("Couldn't load your statistics.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('91.4')).toBeInTheDocument();
  });
});

describe('rounds', () => {
  test('applying filters puts them in the URL and in the request', async () => {
    renderApp('/rounds');
    expect(await screen.findByText('Personal best')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Holes'), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText('Course'), { target: { value: COURSE_ID } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() =>
      expect(roundsService.list).toHaveBeenLastCalledWith(
        { courseId: COURSE_ID, holes: '18', page: 1, limit: 10, sort: '-playedAt' },
        expect.anything(),
      ),
    );
    expect(location()).toBe(`/rounds?courseId=${COURSE_ID}&holes=18`);
  });

  test('no matching rounds shows the empty state', async () => {
    roundsService.list.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    renderApp('/rounds?holes=9');
    expect(await screen.findByText(/No rounds match these filters/)).toBeInTheDocument();
  });

  test('round detail: scorecard, then delete after confirming', async () => {
    const holes = Array.from({ length: 18 }, (_, i) => ({
      number: i + 1, par: 4, distanceMetres: 350, strokes: i === 0 ? 3 : 5, putts: 2, penalties: 0, teeClub: 'driver',
      shots: i === 0 ? [{ seq: 1, club: 'driver', distanceMetres: 219, result: 'rough-left' }] : undefined,
    }));
    roundsService.get.mockResolvedValue({
      ...ROUND_SUMMARY,
      source: 'mobile-app',
      syncedAt: '2026-09-12T04:41:00.000Z',
      course: { id: 'c1', name: 'Omanu Golf Club', par: 72 },
      holes,
      notes: 'Windy back nine',
    });
    roundsService.remove.mockResolvedValue();
    renderApp(`/rounds/${ROUND_SUMMARY.id}`);

    expect(await screen.findByRole('heading', { name: 'Omanu Golf Club · 12 Sep 2026' })).toBeInTheDocument();
    expect(screen.getByText('Windy back nine')).toBeInTheDocument();
    expect(screen.getByText('Rough, left')).toBeInTheDocument();
    expect(roundsService.get).toHaveBeenCalledWith(ROUND_SUMMARY.id, expect.anything());

    await userEvent.click(screen.getByRole('button', { name: 'Delete round' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete round' }));
    expect(roundsService.remove).toHaveBeenCalledWith(ROUND_SUMMARY.id);
    expect(await screen.findByText(/Deleted Omanu Golf Club · 12 Sep 2026/)).toBeInTheDocument();
    expect(location()).toBe('/rounds');
  });
});

describe('preferences', () => {
  test('units change at once and roll back if saving fails', async () => {
    let fail;
    usersService.update.mockImplementation(() => new Promise((_, reject) => (fail = reject)));
    renderApp('/dashboard');
    await screen.findByText('91.4');
    const yards = screen.getAllByLabelText('Yards')[0];
    await userEvent.click(yards);
    expect(yards).toBeChecked(); // optimistic
    expect(usersService.update).toHaveBeenCalledWith(USER.id, { preferences: { units: 'imperial' } });
    fail(new ApiError({ status: 0, code: 'NETWORK', message: "Couldn't save." }));
    await waitFor(() => expect(screen.getAllByLabelText('Metres')[0]).toBeChecked()); // rolled back
    expect(screen.getByText("Couldn't save.")).toBeInTheDocument();
  });
});

describe('clubs and leaderboard', () => {
  test('clubs with too few shots get the empty state', async () => {
    clubsService.get.mockResolvedValue({
      userId: USER.id,
      units: 'metric',
      minimumShots: 5,
      clubs: [
        { code: 'driver', label: 'Driver', inBag: true, shotCount: 142, averageMetres: 212, longestMetres: 246, spreadMetres: 24, enoughData: true },
        { code: '4i', label: '4 iron', inBag: true, shotCount: 3, averageMetres: null, longestMetres: null, spreadMetres: null, enoughData: false },
      ],
      updatedAt: null,
    });
    renderApp('/clubs');
    expect(await screen.findByText('212 m')).toBeInTheDocument();
    expect(screen.getByText(/fewer than 5 recorded shots/)).toHaveTextContent('4 iron');
  });

  test('my row is highlighted and the sort chips re-request', async () => {
    leaderboardService.list.mockResolvedValue({
      data: [
        { rank: 1, userId: 'u1', displayName: 'Tane W.', homeCourse: 'Tauranga Golf Club', averageScore: 78.2, improvement: -1.4, roundsPlayed: 42 },
        { rank: 2, userId: USER.id, displayName: 'Aroha M.', homeCourse: 'Omanu Golf Club', averageScore: 91.4, improvement: -2.1, roundsPlayed: 37 },
      ],
      meta: { sort: 'avgScore', period: 'season', minimumRounds: 3, page: 1, limit: 25, total: 2, currentUser: { rank: 2, onLeaderboard: true } },
    });
    renderApp('/leaderboard');
    expect((await screen.findByText('Aroha M. (you)')).closest('tr')).toHaveClass('me');
    await userEvent.click(screen.getByRole('link', { name: 'Most improved' }));
    await waitFor(() =>
      expect(leaderboardService.list).toHaveBeenLastCalledWith({ sort: 'improved', period: 'season', page: 1, limit: 25 }, expect.anything()),
    );
    expect(location()).toBe('/leaderboard?sort=improved');
  });
});

describe('settings', () => {
  test('a 422 from the profile form is shown beside the field', async () => {
    usersService.update.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_FAILED', message: 'Some fields are not valid.', details: [{ field: 'homeCourseId', issue: 'is not one of your courses' }] }),
    );
    renderApp('/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('is not one of your courses')).toBeInTheDocument();
  });

  test('deleting the account needs DELETE typed first', async () => {
    usersService.remove.mockResolvedValue();
    renderApp('/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete my account' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/to confirm/), 'delete');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(usersService.remove).toHaveBeenCalledWith(USER.id);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});
