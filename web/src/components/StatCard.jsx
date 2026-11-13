// VIEW: one number card (template .card with .stat-label / .stat-value / .trend).
export function StatCard({ label, value, suffix, trend, trendTone = 'muted', children }) {
  return (
    <article className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value ?? '–'}
        {suffix && <small>{suffix}</small>}
      </div>
      {trend && <div className={`trend ${trendTone}`}>{trend}</div>}
      {children}
    </article>
  );
}

/**
 * Words for a change where lower is better (score, putts): ▼ is good (green),
 * ▲ is worse (red), as in the template.
 */
export function lowerIsBetter(change, against, improving = 'vs') {
  if (change === null || change === undefined || !against) {
    return { text: against ? `No ${against} rounds to compare` : null, tone: 'muted' };
  }
  if (change === 0) return { text: `Same as ${against}`, tone: 'muted' };
  const size = Math.abs(change).toFixed(1);
  if (change < 0) return { text: `▼ ${size} ${improving === 'vs' ? `vs ${against}` : 'improving'}`, tone: 'up' };
  return { text: `▲ ${size} vs ${against}`, tone: 'down' };
}
