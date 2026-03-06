import { useMemo, useState } from "react";

const PALETTE = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#f97316",
  "#84cc16",
];

function colorForCluster(clusterId) {
  const safe = Number.isFinite(clusterId) ? Math.abs(clusterId) : 0;
  return PALETTE[safe % PALETTE.length];
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function similarityToColor(similarity) {
  const t = clamp01(similarity);
  const hue = 8 + t * 132;
  const sat = 84;
  const light = 52;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function normalizePoints(points) {
  if (!points?.length) return [];

  const xs = points.map((p) => p.coords?.[0] ?? 0);
  const ys = points.map((p) => p.coords?.[1] ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  return points.map((point) => ({
    ...point,
    normX: ((point.coords?.[0] ?? 0) - minX) / spanX,
    normY: ((point.coords?.[1] ?? 0) - minY) / spanY,
  }));
}

export default function UserSequenceClusterMap({ mapData }) {
  const [selected, setSelected] = useState(null);
  const [colorMode, setColorMode] = useState("cluster");
  const points = useMemo(
    () => normalizePoints(mapData?.points || []),
    [mapData?.points]
  );
  const clusters = mapData?.clusters || [];

  if (!points.length) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-base-content/60">
        No sequence-cluster visualization data yet.
      </div>
    );
  }

  const width = 900;
  const height = 420;
  const padding = 44;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  return (
    <div className="h-full w-full p-2 flex flex-col gap-2">
      <div className="flex items-center justify-between rounded-md border border-primary/20 bg-base-200/80 px-3 py-2 text-xs">
        <div className="font-semibold">Point Coloring</div>
        <div className="join">
          <button
            type="button"
            className={`btn btn-xs join-item ${
              colorMode === "cluster" ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => setColorMode("cluster")}
          >
            Cluster
          </button>
          <button
            type="button"
            className={`btn btn-xs join-item ${
              colorMode === "similarity" ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => setColorMode("similarity")}
          >
            Similarity
          </button>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full rounded-lg">
        <rect x="0" y="0" width={width} height={height} fill="#0f172a" rx="10" />
        <rect
          x={padding}
          y={padding}
          width={plotWidth}
          height={plotHeight}
          fill="rgba(148,163,184,0.05)"
          stroke="rgba(148,163,184,0.2)"
        />
        {[1, 2, 3, 4].map((idx) => {
          const x = padding + (plotWidth * idx) / 5;
          const y = padding + (plotHeight * idx) / 5;
          return (
            <g key={`grid-${idx}`}>
              <line
                x1={x}
                y1={padding}
                x2={x}
                y2={padding + plotHeight}
                stroke="rgba(148,163,184,0.18)"
              />
              <line
                x1={padding}
                y1={y}
                x2={padding + plotWidth}
                y2={y}
                stroke="rgba(148,163,184,0.18)"
              />
            </g>
          );
        })}

        {points.map((point, idx) => {
          const x = padding + point.normX * plotWidth;
          const y = padding + (1 - point.normY) * plotHeight;
          const color =
            colorMode === "similarity"
              ? similarityToColor(point.similarity)
              : colorForCluster(point.cluster_id);
          return (
            <circle
              key={`point-${idx}`}
              cx={x}
              cy={y}
              r={selected?.user_id === point.user_id ? 7 : 5}
              fill={color}
              opacity={selected?.user_id === point.user_id ? 1 : 0.88}
              onClick={() => setSelected(point)}
              style={{ cursor: "pointer" }}
            />
          );
        })}

        <text
          x={padding}
          y={height - 12}
          fill="rgba(226,232,240,0.75)"
          fontSize="11"
          fontFamily="monospace"
        >
          Embedding component 1
        </text>
        <text
          x={10}
          y={padding + 10}
          fill="rgba(226,232,240,0.75)"
          fontSize="11"
          fontFamily="monospace"
          transform={`rotate(-90 10 ${padding + 10})`}
        >
          Embedding component 2
        </text>
      </svg>

      <div className="rounded-md border border-primary/20 bg-base-200/80 px-3 py-2 text-xs">
        {selected ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-base-content/60">User</div>
              <div className="font-semibold">{selected.user_id}</div>
            </div>
            <div>
              <div className="text-base-content/60">Cluster / Sequence</div>
              <div className="font-semibold">
                C{selected.cluster_id} / {selected.sequence_len} batches
              </div>
            </div>
            <div>
              <div className="text-base-content/60">Similarity</div>
              <div className="font-semibold">{selected.similarity.toFixed(3)}</div>
            </div>
          </div>
        ) : (
          <div className="text-base-content/60">
            Click a point to inspect user sequence cluster assignment.
          </div>
        )}
      </div>

      {colorMode === "cluster" ? (
        <div className="rounded-md border border-primary/20 bg-base-200/80 px-3 py-2 text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
          {clusters.map((cluster) => (
            <div
              key={`cluster-${cluster.cluster_id}`}
              className="rounded border border-primary/10 bg-base-300/60 px-2 py-1"
            >
              <div className="inline-flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colorForCluster(cluster.cluster_id) }}
                />
                <span className="font-semibold">C{cluster.cluster_id}</span>
              </div>
              <div className="text-base-content/60 mt-1">Users: {cluster.count}</div>
              <div className="text-base-content/60">
                Avg similarity: {cluster.avg_similarity.toFixed(3)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-primary/20 bg-base-200/80 px-3 py-2 text-xs">
          <div className="font-semibold mb-2">Similarity Gradient</div>
          <div className="h-3 w-full rounded bg-[linear-gradient(90deg,hsl(8,84%,52%),hsl(140,84%,52%))]" />
          <div className="mt-1 flex items-center justify-between text-base-content/60">
            <span>0.00 (far from center)</span>
            <span>1.00 (near center)</span>
          </div>
        </div>
      )}
    </div>
  );
}
