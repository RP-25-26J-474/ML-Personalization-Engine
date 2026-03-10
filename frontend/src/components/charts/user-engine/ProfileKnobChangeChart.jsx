const KNOB_CONFIG = [
  { key: "font_size", label: "Font", min: 10, max: 32, color: "bg-primary" },
  { key: "target_size", label: "Target", min: 24, max: 44, color: "bg-secondary" },
  { key: "line_height", label: "Line", min: 1, max: 2.5, color: "bg-accent" },
  { key: "element_spacing_x", label: "Space X", min: 0, max: 24, color: "bg-info" },
  { key: "element_spacing_y", label: "Space Y", min: 0, max: 24, color: "bg-success" },
  { key: "element_padding_x", label: "Pad X", min: 0, max: 24, color: "bg-warning" },
  { key: "element_padding_y", label: "Pad Y", min: 0, max: 24, color: "bg-error" },
];

function formatValue(value) {
  if (typeof value !== "number") {
    return "--";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function ProfileKnobChangeChart({ profile, profileChanges }) {
  const rows = KNOB_CONFIG.map((item) => {
    const value = typeof profile?.[item.key] === "number" ? profile[item.key] : null;
    const normalized =
      value == null ? 0 : Math.max(0, Math.min(1, (value - item.min) / (item.max - item.min)));
    const oldValue =
      typeof profileChanges?.old?.[item.key] === "number" ? profileChanges.old[item.key] : null;
    const newValue =
      typeof profileChanges?.new?.[item.key] === "number" ? profileChanges.new[item.key] : null;
    const delta =
      oldValue != null && newValue != null ? Number((newValue - oldValue).toFixed(2)) : null;

    return {
      ...item,
      value,
      normalized,
      oldValue,
      delta,
    };
  });

  const hasValues = rows.some((row) => row.value != null);

  if (!hasValues) {
    return <div className="text-sm text-base-content/60">No numeric profile knobs available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <div key={row.key} className="rounded-xl border border-primary/10 bg-base-100 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-base-content/50">
                  {row.label}
                </div>
                <div className="mt-1 text-lg font-semibold">{formatValue(row.value)}</div>
              </div>
              {row.delta != null ? (
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    row.delta > 0
                      ? "bg-success/15 text-success"
                      : row.delta < 0
                        ? "bg-error/15 text-error"
                        : "bg-base-300 text-base-content/60"
                  }`}
                >
                  {row.delta > 0 ? "+" : ""}
                  {formatValue(row.delta)}
                </span>
              ) : null}
            </div>
            {row.oldValue != null ? (
              <div className="mt-1 text-xs text-base-content/50">
                Was {formatValue(row.oldValue)}
              </div>
            ) : null}
            <div className="mt-1 text-xs text-base-content/50">
              Range: {row.min} to {row.max}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/10 bg-base-100 p-4">
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[72px_minmax(0,1fr)_56px] items-center gap-3">
              <div className="text-xs text-base-content/60">{row.label}</div>
              <div>
                <div className="h-3 overflow-hidden rounded-full bg-base-300">
                  <div
                    className={`h-full rounded-full ${row.color}`}
                    style={{ width: `${Math.max(row.normalized * 100, row.value != null ? 4 : 0)}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-base-content/45">
                  <span>{row.min}</span>
                  <span>{row.max}</span>
                </div>
              </div>
              <div className="text-right text-xs font-medium text-base-content/70">
                <div>{formatValue(row.value)}</div>
                {row.delta != null ? (
                  <div
                    className={
                      row.delta > 0
                        ? "text-success"
                        : row.delta < 0
                          ? "text-error"
                          : "text-base-content/50"
                    }
                  >
                    {row.delta > 0 ? "+" : ""}
                    {formatValue(row.delta)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
