import { formatNumber } from '../lib/format.ts';

// new Date('2026-10-14') would be UTC midnight, the day before in the Americas
const toDate = (day: string) => new Date(`${day}T12:00:00`);
const dayShort = (day: string) => toDate(day).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
const dayLong = (day: string) => toDate(day).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

export function VotesChart({ data }: { data: { day: string; votes: number }[] }) {
  if (data.length === 0) return <p className="empty">Noch keine bestätigten Stimmen.</p>;
  const W = 640;
  const H = 200;
  const pad = { top: 16, right: 8, bottom: 26, left: 40 };
  const max = Math.max(...data.map((d) => d.votes));
  const niceMax = Math.ceil(max / 50) * 50 || 10;
  const bw = (W - pad.left - pad.right) / data.length;
  const y = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / niceMax);
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.ceil(data.length / 8);
  const peak = data.reduce((a, b) => (b.votes > a.votes ? b : a));

  return (
    <figure className="chart-figure">
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Bestätigte Stimmen pro Tag. Höchster Wert: ${formatNumber(peak.votes)} Stimmen am ${dayLong(peak.day)}.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#d9dde3" />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.day}>
            <rect
              x={pad.left + i * bw + bw * 0.15}
              y={y(d.votes)}
              width={bw * 0.7}
              height={Math.max(0, y(0) - y(d.votes))}
              fill={d === peak ? '#2140B8' : '#8ea0e3'}
              rx={2}
            >
              <title>{`${dayShort(d.day)}: ${d.votes} Stimmen`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={pad.left + i * bw + bw / 2} y={H - 8} textAnchor="middle">
                {dayShort(d.day)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="small muted">
        Die meisten Stimmen kamen am {dayLong(peak.day)} ({formatNumber(peak.votes)}).
      </figcaption>
    </figure>
  );
}
