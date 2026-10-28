import { useEffect, useMemo, useRef, useState } from 'react';

type Series = { value: number; color: string; name: string };
type TrendPoint = { label: string; series: Series[] };

const HEIGHT = 300;
const PAD = { top: 20, right: 24, bottom: 34, left: 52 };

function niceMax(v: number) {
  if (v <= 0) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * exp;
}

function monotonePath(p: [number, number][]) {
  const n = p.length;
  if (n === 0) return '';
  if (n === 1) return `M${p[0][0]},${p[0][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1][0] - p[i][0];
    m[i] = (p[i + 1][1] - p[i][1]) / dx[i];
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
    } else {
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        t[i] = tau * a * m[i];
        t[i + 1] = tau * b * m[i];
      }
    }
  }
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = p[i][0] + dx[i] / 3;
    const c1y = p[i][1] + (t[i] * dx[i]) / 3;
    const c2x = p[i + 1][0] - dx[i] / 3;
    const c2y = p[i + 1][1] - (t[i + 1] * dx[i]) / 3;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p[i + 1][0]},${p[i + 1][1]}`;
  }
  return d;
}

const fmt = (v: number) => v.toLocaleString('az-AZ');

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data.length]);

  const names = useMemo(() => (data[0]?.series ?? []).map(s => ({ name: s.name, color: s.color })), [data]);
  const maxValue = useMemo(
    () => niceMax(Math.max(0, ...data.flatMap(d => d.series.map(s => s.value)))),
    [data],
  );

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const xAt = (i: number) => PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => PAD.top + innerH - (v / maxValue) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * maxValue);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">Məlumat yoxdur</p>;
  }

  const handleMove = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    data.forEach((_, i) => {
      const dist = Math.abs(xAt(i) - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setHover(best);
  };

  const tipLeft = hover === null ? 0 : Math.min(Math.max(xAt(hover), 90), width - 90);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1">
        {names.map(n => (
          <span key={n.name} className="inline-flex items-center gap-1.5 text-sm text-gray-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: n.color }} />
            {n.name}
          </span>
        ))}
      </div>

      <div
        ref={wrapRef}
        className="relative w-full select-none"
        style={{ height: HEIGHT }}
        onMouseMove={e => handleMove(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchMove={e => handleMove(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
      >
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="absolute left-0 top-0">
          {ticks.map((tv, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={width - PAD.right} y1={yAt(tv)} y2={yAt(tv)} stroke="#e5e7eb" strokeDasharray={i === 0 ? undefined : '4 4'} />
              <text x={PAD.left - 8} y={yAt(tv) + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{fmt(Math.round(tv))}</text>
            </g>
          ))}

          {data.map((d, i) => (
            <text key={d.label} x={xAt(i)} y={HEIGHT - 10} textAnchor="middle" fontSize="11" fill="#6b7280">{d.label}</text>
          ))}

          {hover !== null && (
            <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#d1d5db" />
          )}

          {names.map((n, si) => {
            const pts: [number, number][] = data.map((d, i) => [xAt(i), yAt(d.series[si]?.value ?? 0)]);
            const line = monotonePath(pts);
            const area = `${line} L${pts[pts.length - 1][0]},${PAD.top + innerH} L${pts[0][0]},${PAD.top + innerH} Z`;
            return (
              <g key={n.name}>
                <path d={area} fill={n.color} fillOpacity="0.07" />
                <path d={line} fill="none" stroke={n.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((pt, i) => (
                  <circle key={i} cx={pt[0]} cy={pt[1]} r={hover === i ? 5 : 3.5} fill="#fff" stroke={n.color} strokeWidth="2" />
                ))}
              </g>
            );
          })}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: tipLeft }}
          >
            <p className="mb-1 font-semibold text-gray-800">{data[hover].label}</p>
            {data[hover].series.map(s => (
              <p key={s.name} className="flex items-center gap-1.5 text-gray-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}: <span className="font-semibold text-gray-900">{fmt(s.value)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
