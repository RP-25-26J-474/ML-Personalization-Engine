import { formatJson } from "../../utils/json";
import { formatDate } from "../../utils/DateUtils";

const formatValue = (value) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) return "null";
  return formatJson(value);
};

export default function ProfileDiffHistory({ items = [], userId = "" }) {
  if (!items.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-base-content/60">
        No profile history yet.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3 text-sm">
      <div className="mb-2 text-xs text-base-content/60">
        User: {userId || "--"}
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={`profile-${item.version}-${item.created_at}`}
            className="rounded-md border border-primary/20 bg-base-200/70 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-semibold">
                v{item.version} · {item.origin}
              </div>
              <div className="text-base-content/60">{formatDate(item.created_at)}</div>
            </div>
            <div className="mt-2 text-xs text-base-content/60">
              Changes: {item.changed?.length ?? 0}
            </div>
            <div className="mt-2 grid gap-2 text-xs font-mono">
              {(item.changed || []).map((key) => (
                <div
                  key={`${item.version}-${key}`}
                  className="rounded bg-base-300/70 px-2 py-1"
                >
                  <div className="text-base-content/70">{key}</div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-base-content/50">
                      {formatValue(item.old?.[key])}
                    </span>
                    <span className="text-base-content/40">→</span>
                    <span className="text-base-content">
                      {formatValue(item.new?.[key])}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
