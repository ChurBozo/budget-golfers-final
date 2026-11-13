// VIEW: the template's donut for tee shots on target, plus the common miss.
import { clubLabel } from '../utils/clubs';
import { EmptyState } from './Common';

export function AccuracyDonut({ accuracy }) {
  const pct = accuracy.teeShotsOnTargetPct;
  if (pct === null || pct === undefined) {
    return (
      <EmptyState icon="clubs">
        Mark your tee shots on the map in the app to see how many finish on target.
      </EmptyState>
    );
  }
  const miss = accuracy.commonMiss;
  return (
    <div className="donut-wrap">
      <div
        className="donut"
        data-value={`${pct}%`}
        style={{ background: `conic-gradient(var(--bottle-green) 0 ${pct}%, var(--turquoise-green) ${pct}% 100%)` }}
        role="img"
        aria-label={`${pct} percent of tee shots finished on target`}
      />
      <div>
        <p>
          <b>{pct}%</b> of tee shots on target
        </p>
        <p className="muted">
          {miss ? (
            <>
              Most common miss: <b>{miss.direction}</b>
              {miss.club && <> with the {clubLabel(miss.club).toLowerCase()}</>} (from shot pins in the app)
            </>
          ) : (
            'No misses to the left or right recorded yet.'
          )}
        </p>
        {accuracy.greensInRegulationPct !== null && (
          <p className="muted" style={{ margin: 0 }}>
            Greens in regulation: <b>{accuracy.greensInRegulationPct}%</b>
          </p>
        )}
      </div>
    </div>
  );
}
