import { useEffect, useMemo, useRef } from "react";

const DEFAULT_PADDING = 24;

function normalizePoints(points) {
  if (!points?.length) return [];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  return points.map(([x, y]) => ({
    x: (x - minX) / spanX,
    y: (y - minY) / spanY,
  }));
}

function drawScatter({
  canvas,
  points,
  neighborSet,
  width,
  height,
  padding,
}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, height);

  const plotWidth = Math.max(1, width - padding * 2);
  const plotHeight = Math.max(1, height - padding * 2);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i += 1) {
    const x = padding + (plotWidth * i) / 5;
    const y = padding + (plotHeight * i) / 5;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  points.forEach((point, index) => {
    const x = padding + point.x * plotWidth;
    const y = padding + (1 - point.y) * plotHeight;
    const isNeighbor = neighborSet.has(index);
    const radius = isNeighbor ? 4 : 2;
    ctx.beginPath();
    ctx.fillStyle = isNeighbor ? "#f97316" : "rgba(148, 163, 184, 0.55)";
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

export default function CategoryNearestNeighbor({
  points = [],
  neighborIndices = [],
  neighborDistances = [],
}) {
  const canvasRef = useRef(null);
  const normalized = useMemo(() => normalizePoints(points), [points]);
  const neighborSet = useMemo(
    () => new Set(neighborIndices || []),
    [neighborIndices]
  );
  const neighbors = useMemo(() => {
    return (neighborIndices || [])
      .map((index, i) => ({
        index,
        distance:
          typeof neighborDistances?.[i] === "number"
            ? neighborDistances[i]
            : null,
      }))
      .sort((a, b) => {
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      })
      .slice(0, 5);
  }, [neighborIndices, neighborDistances]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !normalized.length) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScatter({
        canvas,
        points: normalized,
        neighborSet,
        width: rect.width,
        height: rect.height,
        padding: DEFAULT_PADDING,
      });
    };

    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }
    resize();

    return () => {
      observer.disconnect();
    };
  }, [normalized, neighborSet]);

  if (!normalized.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm opacity-70 h-full">
        No vector space data yet.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute left-3 top-3 rounded-md bg-base-200/90 border border-primary/20 px-3 py-2 text-[11px]">
        <div className="font-semibold text-xs">UMAP 2D Projection</div>
        <div className="mt-1 text-base-content/60">
          {neighborIndices?.length
            ? `${neighborIndices.length} nearest neighbors highlighted`
            : "Run onboarding to highlight neighbors"}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-300/70"></span>
            All samples
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-400"></span>
            Neighbors
          </span>
        </div>
        {neighbors.length ? (
          <div className="mt-2 text-base-content/60">
            {neighbors
              .map((item) =>
                item.distance != null
                  ? `#${item.index} (${item.distance.toFixed(3)})`
                  : `#${item.index}`
              )
              .join(", ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
