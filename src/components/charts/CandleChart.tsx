import { generateCandles } from "@/lib/market-data";

interface Props {
  seed?: number;
  count?: number;
  height?: number;
  showAxis?: boolean;
}

export function CandleChart({ seed = 42, count = 80, height = 320, showAxis = true }: Props) {
  const candles = generateCandles(seed, count);
  const min = Math.min(...candles.map((c) => c.l));
  const max = Math.max(...candles.map((c) => c.h));
  const range = max - min;
  const width = 1000;
  const cw = (width - 60) / count;
  const padR = 60;

  const y = (v: number) => ((max - v) / range) * (height - 30) + 10;

  // moving average
  const ma = candles.map((_, i) => {
    const slice = candles.slice(Math.max(0, i - 8), i + 1);
    return slice.reduce((s, c) => s + c.c, 0) / slice.length;
  });
  const maPath = ma
    .map((v, i) => `${i === 0 ? "M" : "L"}${i * cw + cw / 2},${y(v)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      {/* grid */}
      {[0.2, 0.4, 0.6, 0.8].map((p) => (
        <line
          key={p}
          x1={0}
          x2={width - padR}
          y1={p * height}
          y2={p * height}
          stroke="var(--grid-line)"
          strokeWidth={1}
        />
      ))}
      {candles.map((c, i) => {
        const x = i * cw;
        const up = c.c >= c.o;
        const color = up ? "var(--bull)" : "var(--bear)";
        return (
          <g key={i}>
            <line x1={x + cw / 2} x2={x + cw / 2} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth={1} />
            <rect
              x={x + 1}
              y={y(Math.max(c.o, c.c))}
              width={Math.max(1, cw - 2)}
              height={Math.max(1, Math.abs(y(c.o) - y(c.c)))}
              fill={color}
            />
          </g>
        );
      })}
      <path d={maPath} fill="none" stroke="var(--gold)" strokeWidth={1.2} opacity={0.9} />
      {showAxis && (
        <g fontFamily="var(--font-mono)" fontSize={10} fill="var(--muted-foreground)">
          {[0.1, 0.35, 0.6, 0.85].map((p) => {
            const v = max - p * range;
            return (
              <text key={p} x={width - padR + 6} y={p * height + 4}>
                {v.toFixed(2)}
              </text>
            );
          })}
        </g>
      )}
      {/* current price marker */}
      <g>
        <line
          x1={0}
          x2={width - padR}
          y1={y(candles[candles.length - 1].c)}
          y2={y(candles[candles.length - 1].c)}
          stroke="var(--gold)"
          strokeWidth={0.8}
          strokeDasharray="3 3"
          opacity={0.7}
        />
        <rect
          x={width - padR}
          y={y(candles[candles.length - 1].c) - 9}
          width={padR}
          height={18}
          fill="var(--gold)"
        />
        <text
          x={width - 6}
          y={y(candles[candles.length - 1].c) + 4}
          textAnchor="end"
          fontFamily="var(--font-mono)"
          fontSize={10}
          fill="var(--primary-foreground)"
          fontWeight={600}
        >
          {candles[candles.length - 1].c.toFixed(2)}
        </text>
      </g>
    </svg>
  );
}

export function SparkLine({
  data,
  color = "var(--gold)",
  height = 40,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const w = 120;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i / (data.length - 1)) * w},${height - ((v - min) / range) * height}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
