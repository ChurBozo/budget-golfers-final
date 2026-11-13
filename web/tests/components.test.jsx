// VIEW components render props only, so they are tested without the API.
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Scorecard } from '../src/components/Scorecard';
import { LeaderboardTable } from '../src/components/LeaderboardTable';
import { RoundRow } from '../src/components/RoundList';
import { lowerIsBetter } from '../src/components/StatCard';
import { ClubBars } from '../src/components/Clubs';
import { ConfirmDialog, ErrorState } from '../src/components/Common';
import { Pagination } from '../src/components/Controls';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

function nine(start, scores) {
  const holes = scores.map((strokes, i) => ({ number: start + i, par: 4, strokes, putts: 2, distance: 300, teeClub: 'driver', shots: [] }));
  return {
    label: start === 1 ? 'Out' : 'In',
    holes,
    totals: { par: 36, strokes: scores.reduce((a, b) => a + b, 0), putts: 18, distance: 2700 },
  };
}

describe('Scorecard', () => {
  test('marks birdies, pars, bogeys and doubles, with Out, In and Total', () => {
    const front = nine(1, [3, 4, 5, 6, 4, 4, 4, 4, 4]);
    const back = nine(10, [4, 4, 4, 4, 4, 4, 4, 4, 5]);
    const { container } = render(<Scorecard nines={[front, back]} units="metric" />);
    const marks = [...container.querySelectorAll('.sc')].slice(0, 4).map((el) => el.className);
    expect(marks).toEqual(['sc birdie', 'sc par', 'sc bogey', 'sc double']);
    expect(screen.getByText('Out')).toBeInTheDocument();
    expect(screen.getByText('In')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument(); // 38 out + 37 in
    expect(screen.getAllByText('Distance (m)')).toHaveLength(2);
  });

  test('the distance row follows the unit preference', () => {
    render(<Scorecard nines={[nine(1, [4, 4, 4, 4, 4, 4, 4, 4, 4])]} units="imperial" />);
    expect(screen.getByText('Distance (yd)')).toBeInTheDocument();
  });
});

describe('LeaderboardTable', () => {
  const rows = [
    { rank: 1, userId: 'u1', displayName: 'Tane W.', homeCourse: 'Tauranga Golf Club', averageScore: 78.2, improvement: -1.4, roundsPlayed: 42 },
    { rank: 2, userId: 'me', displayName: 'Aroha M.', homeCourse: null, averageScore: 91.4, improvement: 0.5, roundsPlayed: 37 },
  ];

  test("highlights the signed-in golfer's row and formats the numbers", () => {
    wrap(<LeaderboardTable rows={rows} myUserId="me" sort="avgScore" sortLink={(s) => `/leaderboard?sort=${s}`} />);
    const mine = screen.getByText('Aroha M. (you)').closest('tr');
    expect(mine).toHaveClass('me');
    expect(within(mine).getByText('+0.5')).toBeInTheDocument();
    expect(screen.getByText('−1.4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Improvement' })).toHaveAttribute('href', '/leaderboard?sort=improved');
  });
});

describe('RoundRow', () => {
  test('links to the round and shows a personal best badge', () => {
    const round = {
      id: 'r1',
      playedAt: '2026-09-12T02:10:00.000Z',
      course: { id: 'c1', name: 'Omanu Golf Club' },
      tee: 'Yellow',
      holesPlayed: 18,
      totals: { strokes: 84, toPar: 12, putts: 31, fairwaysHit: 9, fairwaysPossible: 14 },
      isPersonalBest: true,
    };
    wrap(<ul><RoundRow round={round} detail="stats" /></ul>);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/rounds/r1');
    expect(screen.getByText('Personal best')).toBeInTheDocument();
    expect(screen.getByText('18 holes · 31 putts · 9 of 14 fairways')).toBeInTheDocument();
  });
});

describe('StatCard wording', () => {
  test('a lower score is shown as an improvement in green', () => {
    expect(lowerIsBetter(-2.1, 'previous 20')).toEqual({ text: '▼ 2.1 vs previous 20', tone: 'up' });
    expect(lowerIsBetter(1.2, 'previous 20')).toEqual({ text: '▲ 1.2 vs previous 20', tone: 'down' });
    expect(lowerIsBetter(-0.8, 'previous 5', 'improving').text).toBe('▼ 0.8 improving');
    expect(lowerIsBetter(null, 'previous 5').text).toBe('No previous 5 rounds to compare');
  });
});

describe('ClubBars', () => {
  test('bars are scaled to the longest club and show the unit', () => {
    const clubs = [
      { code: 'driver', label: 'Driver', average: 232, widthPct: 100 },
      { code: 'pw', label: 'Pitching wedge', average: 109, widthPct: 47 },
    ];
    const { container } = render(<ClubBars clubs={clubs} units="imperial" />);
    expect(screen.getByText('PW')).toBeInTheDocument();
    expect(screen.getByText('232 yd')).toBeInTheDocument();
    expect(container.querySelectorAll('.bar i')[1]).toHaveStyle({ width: '47%' });
  });
});

describe('states and dialogs', () => {
  test('the error state has a Retry button; a 404 does not reveal anything', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState title="Couldn't load the leaderboard." error={{ status: 0, message: 'Offline' }} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<ErrorState error={{ status: 404, message: 'Round not found.' }} onRetry={onRetry} />);
    expect(screen.getByText('Not found.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  test('the confirm dialog starts on Cancel and closes with Escape', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open title="Delete this round?" confirmLabel="Delete round" onCancel={onCancel} onConfirm={onConfirm}>
        Sure?
      </ConfirmDialog>,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete round' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  test('pagination shows the range and disables Previous on page 1', () => {
    const onPage = vi.fn();
    render(<Pagination page={1} totalPages={4} total={37} shown={{ limit: 10, count: 10 }} onPage={onPage} />);
    expect(screen.getByText('Showing 1–10 of 37 rounds')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});
