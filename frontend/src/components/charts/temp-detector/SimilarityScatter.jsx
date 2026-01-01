import { useMemo } from "react";

function clamp01(value) {
  if (typeof value !== "number") return 0;
  return Math.max(0, Math.min(1, value));
}

const COLORS = {
  keep: "#22c55e",
  quarantine: "#f59e0b",
  reject: "#ef4444",
  unknown: "rgba(148, 163, 184, 0.7)",
};

export default function SimilarityScatter({ items = [] }) {
  const points = useMemo(
    () =>
      items.map((item) => ({
        x: clamp01(item?.similarity_score),
        y: clamp01(item?.anomaly_score),
        outcome: item?.outcome || "unknown",
      })),
    [items]
  );

  if (!points.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm opacity-70">
        No scatter data yet.
      </div>
    );
  }

  const width = 320;
  const height = 200;
  const padding = 26;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  return (
    <div className="w-full h-full relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <rect x="0" y="0" width={width} height={height} fill="#0f172a" rx="8" />
        {[1, 2, 3, 4].map((i) => {
          const x = padding + (plotWidth * i) / 5;
          const y = padding + (plotHeight * i) / 5;
          return (
            <g key={`grid-${i}`}>
              <line
                x1={x}
                y1={padding}
                x2={x}
                y2={height - padding}
                stroke="rgba(148, 163, 184, 0.2)"
              />
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="rgba(148, 163, 184, 0.2)"
              />
            </g>
          );
        })}

        {points.map((point, index) => {
          const x = padding + point.x * plotWidth;
          const y = padding + (1 - point.y) * plotHeight;
          return (
            <circle
              key={`pt-${index}`}
              cx={x}
              cy={y}
              r="4"
              fill={COLORS[point.outcome] || COLORS.unknown}
            />
          );
        })}

        <text
          x={padding}
          y={height - 6}
          fill="rgba(226, 232, 240, 0.7)"
          fontSize="10"
          fontFamily="monospace"
        >
          Similarity 0.0
        </text>
        <text
          x={width - padding - 78}
          y={height - 6}
          fill="rgba(226, 232, 240, 0.7)"
          fontSize="10"
          fontFamily="monospace"
        >
          Similarity 1.0
        </text>
        <text
          x={6}
          y={padding + 6}
          fill="rgba(226, 232, 240, 0.7)"
          fontSize="10"
          fontFamily="monospace"
          transform={`rotate(-90 6 ${padding + 6})`}
        >
          Anomaly
        </text>
      </svg>
      <div className="absolute left-3 top-3 rounded-md bg-base-200/90 border border-primary/20 px-2 py-1 text-[10px]">
        <div className="font-semibold text-[10px]">Outcome</div>
        <div className="mt-1 flex flex-col gap-1">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS.keep }} />
            Keep
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: COLORS.quarantine }}
            />
            Quarantine
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: COLORS.reject }}
            />
            Reject
          </span>
        </div>
      </div>
    </div>
  );
}
