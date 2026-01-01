import { useMemo } from "react";

const AXES = [
  { key: "misclick_score", label: "Misclick" },
  { key: "rage_score", label: "Rage" },
  { key: "click_interval_score", label: "Interval" },
  { key: "dwell_score", label: "Dwell" },
  { key: "scroll_score", label: "Scroll" },
];

const OUTCOME_COLORS = {
  keep: "rgba(34, 197, 94, 0.35)",
  quarantine: "rgba(245, 158, 11, 0.35)",
  reject: "rgba(239, 68, 68, 0.35)",
};

const OUTCOME_STROKES = {
  keep: "#22c55e",
  quarantine: "#f59e0b",
  reject: "#ef4444",
};

function averageComponents(items) {
  if (!items.length) return null;
  const totals = {};
  let count = 0;
  items.forEach((item) => {
    const comps = item?.heuristic_components;
    if (!comps) return;
    AXES.forEach((axis) => {
      const value = typeof comps[axis.key] === "number" ? comps[axis.key] : 0;
      totals[axis.key] = (totals[axis.key] || 0) + value;
    });
    count += 1;
  });
  if (!count) return null;
  const averages = {};
  AXES.forEach((axis) => {
    averages[axis.key] = (totals[axis.key] || 0) / count;
  });
  return averages;
}

function toPoints(values, radius, cx, cy) {
  return AXES.map((axis, index) => {
    const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
    const value = values?.[axis.key] ?? 0;
    const r = Math.max(0, Math.min(1, value)) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}

export default function HeuristicRadar({ items = [] }) {
  const groups = useMemo(() => {
    const keep = items.filter((item) => item.outcome === "keep");
    const quarantine = items.filter((item) => item.outcome === "quarantine");
    const reject = items.filter((item) => item.outcome === "reject");
    return {
      keep: averageComponents(keep),
      quarantine: averageComponents(quarantine),
      reject: averageComponents(reject),
    };
  }, [items]);

  const hasData = Boolean(groups.keep || groups.quarantine || groups.reject);

  if (!hasData) {
    return (
      <div className="flex h-full items-center justify-center text-sm opacity-70">
        No heuristic data yet.
      </div>
    );
  }

  const width = 320;
  const height = 140;
  const padding = 30;
  const radius = Math.min(width, height) / 2 - padding;
  const cx = width / 2;
  const cy = height / 2;

  const levels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="w-full h-full relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <rect x="0" y="0" width={width} height={height} fill="#0f172a" rx="8" />
        {levels.map((level) => {
          const points = toPoints(
            AXES.reduce((acc, axis) => ({ ...acc, [axis.key]: level }), {}),
            radius,
            cx,
            cy
          );
          const path = points.map((p) => p.join(",")).join(" ");
          return (
            <polygon
              key={`lvl-${level}`}
              points={path}
              fill="none"
              stroke="rgba(148, 163, 184, 0.3)"
              strokeDasharray="4 4"
            />
          );
        })}

        {AXES.map((axis, index) => {
          const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          return (
            <g key={axis.key}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="rgba(148, 163, 184, 0.4)"
              />
              <text
                x={x}
                y={y}
                fill="rgba(226, 232, 240, 0.8)"
                fontSize="10"
                textAnchor={x < cx ? "end" : "start"}
                dominantBaseline={y < cy ? "baseline" : "hanging"}
              >
                {axis.label}
              </text>
            </g>
          );
        })}

        {Object.entries(groups).map(([key, values]) => {
          if (!values) return null;
          const points = toPoints(values, radius, cx, cy);
          const path = points.map((p) => p.join(",")).join(" ");
          return (
            <polygon
              key={key}
              points={path}
              fill={OUTCOME_COLORS[key]}
              stroke={OUTCOME_STROKES[key]}
              strokeWidth="2"
            />
          );
        })}
      </svg>
      <div className="absolute left-3 top-3 rounded-md bg-base-200/90 border border-primary/20 px-2 py-1 text-[10px]">
        <div className="font-semibold text-[10px]">Outcome Avg</div>
        <div className="mt-1 flex flex-col gap-1">
          {["keep", "quarantine", "reject"].map((key) => (
            <span key={key} className="inline-flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: OUTCOME_STROKES[key] }}
              />
              {key}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
