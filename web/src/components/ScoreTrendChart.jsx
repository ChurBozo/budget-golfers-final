// VIEW: the score trend as a Recharts line chart, replacing the template's
// static SVG placeholder. Score and the 5-round rolling average, oldest first.
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLOURS = {
  light: { grid: '#d6e6df', axis: '#5b6f68', surface: '#ffffff', text: '#16241f' },
  dark: { grid: '#24392f', axis: '#9db5ac', surface: '#15261f', text: '#e4f1ec' },
};

export function ScoreTrendChart({ data, theme = 'light' }) {
  const c = COLOURS[theme] || COLOURS.light;
  const scores = data.flatMap((d) => [d.score, d.rollingAverage]).filter((v) => typeof v === 'number');
  const min = Math.floor((Math.min(...scores) - 2) / 5) * 5;
  const max = Math.ceil((Math.max(...scores) + 2) / 5) * 5;
  const step = max - min > 30 ? 10 : 5;
  const ticks = [];
  for (let t = min; t <= max; t += step) ticks.push(t);
  const label = `Line chart of ${data.length} scores, from ${data[0]?.score} to ${data[data.length - 1]?.score}`;

  return (
    <div className="chart" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[min, max]} ticks={ticks} tick={{ fill: c.axis, fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 8, color: c.text }}
            labelStyle={{ fontWeight: 700 }}
            formatter={(value, name) => [value, name === 'score' ? 'Score' : '5-round average']}
          />
          <Line type="monotone" dataKey="score" stroke="#006a4e" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="rollingAverage"
            stroke="#a0d6b4"
            strokeWidth={3}
            strokeDasharray="6 5"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
