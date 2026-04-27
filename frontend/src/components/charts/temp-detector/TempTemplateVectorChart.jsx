const DEFAULT_FEATURE_LABELS = {
  misclick_rate: "Misclick Rate",
  avg_click_interval_ms: "Click Interval",
  avg_dwell_ms: "Dwell Time",
  rage_clicks: "Rage Clicks",
  zoom_events: "Zoom Events",
  scroll_speed_px_s: "Scroll Speed",
};

const FEATURE_RANGES = {
  misclick_rate: { min: 0, max: 1 },
  avg_click_interval_ms: { min: 150, max: 600 },
  avg_dwell_ms: { min: 300, max: 2000 },
  rage_clicks: { min: 0, max: 6 },
  zoom_events: { min: 0, max: 5 },
  scroll_speed_px_s: { min: 200, max: 700 },
};

export default function TempTemplateVectorChart({ template }) {
  const featureOrder = Array.isArray(template?.feature_order) ? template.feature_order : [];
  const mean = Array.isArray(template?.mean) ? template.mean : [];
  const std = Array.isArray(template?.std) ? template.std : [];

  const rows = featureOrder.map((featureKey, index) => {
    const value = typeof mean[index] === "number" ? mean[index] : null;
    const stdValue = typeof std[index] === "number" ? std[index] : null;
    const range = FEATURE_RANGES[featureKey] || { min: 0, max: 1 };
    const normalized =
      value == null ? 0 : Math.max(0, Math.min(1, (value - range.min) / (range.max - range.min)));

    return {
      key: featureKey,
      label: DEFAULT_FEATURE_LABELS[featureKey] || humanize(featureKey),
      value,
      std: stdValue,
      min: range.min,
      max: range.max,
      normalized,
    };
  });

  if (!rows.length) {
    return <div className="text-sm text-base-content/60">No temp-detector vector available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-xl border border-primary/10 bg-base-100 p-3">
            <div className="text-[11px] uppercase tracking-wide text-base-content/50">{row.label}</div>
            <div className="mt-1 text-lg font-semibold">{formatNumber(row.value)}</div>
            <div className="mt-1 text-xs text-base-content/50">
              Std: {formatNumber(row.std)} | Range: {row.min} to {row.max}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/10 bg-base-100 p-4">
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[96px_minmax(0,1fr)_72px] items-center gap-3">
              <div className="text-xs text-base-content/60">{row.label}</div>
              <div>
                <div className="relative h-3 overflow-hidden rounded-full bg-base-300">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${Math.max(row.normalized * 100, row.value != null ? 4 : 0)}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-base-content/45">
                  <span>{row.min}</span>
                  <span>{row.max}</span>
                </div>
              </div>
              <div className="text-right text-xs font-medium text-base-content/70">
                {formatNumber(row.value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatNumber(value) {
  if (value == null) {
    return "--";
  }
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function humanize(value) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
