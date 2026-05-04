import { getVerdict } from "@/lib/apgar";

interface ApgarCircleProps {
  results: { score: number; created_at: string }[];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function sectorPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startAngle: number, endAngle: number,
) {
  const o1 = polarToCartesian(cx, cy, outerR, startAngle);
  const o2 = polarToCartesian(cx, cy, outerR, endAngle);
  const i1 = polarToCartesian(cx, cy, innerR, endAngle);
  const i2 = polarToCartesian(cx, cy, innerR, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M${o1.x.toFixed(3)} ${o1.y.toFixed(3)}`,
    `A${outerR} ${outerR} 0 ${large} 1 ${o2.x.toFixed(3)} ${o2.y.toFixed(3)}`,
    `L${i1.x.toFixed(3)} ${i1.y.toFixed(3)}`,
    `A${innerR} ${innerR} 0 ${large} 0 ${i2.x.toFixed(3)} ${i2.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

const SECTOR_COLORS = {
  good: "var(--success)",
  warning: "var(--warning)",
  critical: "var(--destructive)",
  empty: "currentColor",
} as const;

export function ApgarCircle({ results }: ApgarCircleProps) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthName = now.toLocaleString("ru-RU", { month: "long" });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Group by day — results are newest-first, so first occurrence = latest that day
  const scoreByDay: Record<number, number> = {};
  for (const r of results) {
    const d = new Date(r.created_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!(day in scoreByDay)) scoreByDay[day] = r.score;
    }
  }

  const cx = 150, cy = 150;
  const outerR = 132, innerR = 72;
  const gap = 0.9;
  const anglePerDay = 360 / daysInMonth;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 300" className="w-full max-w-[280px]" role="img" aria-label="APGAR calendar">
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const start = i * anglePerDay + gap;
          const end = (i + 1) * anglePerDay - gap;
          const score = scoreByDay[day];
          const level = score !== undefined ? getVerdict(score).level : "empty";
          const isToday = day === today;

          return (
            <path
              key={day}
              d={sectorPath(cx, cy, outerR, innerR, start, end)}
              fill={SECTOR_COLORS[level]}
              fillOpacity={level === "empty" ? 0.12 : 0.88}
              stroke={isToday ? "var(--primary)" : "none"}
              strokeWidth={isToday ? 2.5 : 0}
            >
              <title>{`${day} ${monthLabel}${score !== undefined ? ` · ${score}/10` : ""}`}</title>
            </path>
          );
        })}

        {/* Today marker dot on outer ring */}
        {(() => {
          const midAngle = (today - 1 + 0.5) * anglePerDay;
          const dot = polarToCartesian(cx, cy, outerR + 8, midAngle);
          return (
            <circle
              cx={dot.x} cy={dot.y} r={3.5}
              fill="var(--primary)"
            />
          );
        })()}

        {/* Center label */}
        <text
          x={cx} y={cy - 10}
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          fill="var(--foreground)"
          fontFamily="inherit"
        >
          {monthLabel}
        </text>
        <text
          x={cx} y={cy + 10}
          textAnchor="middle"
          fontSize="12"
          fill="var(--muted-foreground)"
          fontFamily="inherit"
        >
          {year}
        </text>
        <text
          x={cx} y={cy + 28}
          textAnchor="middle"
          fontSize="11"
          fill="var(--muted-foreground)"
          fontFamily="inherit"
        >
          {Object.keys(scoreByDay).length} / {daysInMonth} дней
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--success)" }} />
          Хорошо
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--warning)" }} />
          Умеренно
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--destructive)" }} />
          Критично
        </span>
      </div>
    </div>
  );
}
