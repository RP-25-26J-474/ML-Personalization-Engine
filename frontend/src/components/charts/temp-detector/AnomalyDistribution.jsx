import { useMemo } from "react";

const DEFAULT_BINS = 10;

function clamp01(value) {
  if (typeof value !== "number") return 0;
  return Math.max(0, Math.min(1, value));
}

function buildHistogram(items, bins) {
  const counts = Array.from({ length: bins }, () => 0);
  items.forEach((item) => {
    const score = clamp01(item?.anomaly_score);
    const idx = Math.min(bins - 1, Math.floor(score * bins));
    counts[idx] += 1;
  });
  return counts;
}

export default function AnomalyDistribution({
  items = [],
  thresholds = {},
  bins = DEFAULT_BINS,
}) {
  const histogram = useMemo(() => buildHistogram(items, bins), [items, bins]);
  const maxCount = Math.max(1, ...histogram);
  const quarantineThreshold =
    typeof thresholds?.quarantine_threshold === "number"
      ? thresholds.quarantine_threshold
      : 0.6;
  const rejectThreshold =
    typeof thresholds?.reject_threshold === "number"
      ? thresholds.reject_threshold
      : 0.85;

  if (!items.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm opacity-70">
        No anomaly scores yet.
      </div>
    );
  }

  const width = 320;
  const height = 140;
  const padding = 26;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const barWidth = plotWidth / bins;

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <rect x="0" y="0" width={width} height={height} fill="#0f172a" rx="8" />
        {histogram.map((count, index) => {
          const barHeight = (count / maxCount) * plotHeight;
          const x = padding + index * barWidth + 1;
          const y = padding + (plotHeight - barHeight);
          return (
            <rect
              key={`bar-${index}`}
              x={x}
              y={y}
              width={Math.max(1, barWidth - 2)}
              height={barHeight}
              fill="rgba(96, 165, 250, 0.8)"
              rx="2"
            />
          );
        })}

        {[
          { value: quarantineThreshold, color: "#f59e0b", label: "Q" },
          { value: rejectThreshold, color: "#ef4444", label: "R" },
        ].map((line) => {
          const x = padding + clamp01(line.value) * plotWidth;
          return (
            <g key={line.label}>
              <line
                x1={x}
                y1={padding}
                x2={x}
                y2={height - padding}
                stroke={line.color}
                strokeDasharray="4 4"
              />
              <text
                x={x + 4}
                y={padding + 12}
                fill={line.color}
                fontSize="10"
                fontFamily="monospace"
              >
                {line.label}
              </text>
            </g>
          );
        })}

        <text
          x={padding}
          y={height - 6}
          fill="rgba(226, 232, 240, 0.7)"
          fontSize="10"
          fontFamily="monospace"
        >
          0.0
        </text>
        <text
          x={width - padding - 18}
          y={height - 6}
          fill="rgba(226, 232, 240, 0.7)"
          fontSize="10"
          fontFamily="monospace"
        >
          1.0
        </text>
      </svg>
    </div>
  );
}
