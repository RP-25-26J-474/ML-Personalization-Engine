export default function ChartSection({
  title,
  subtitle,
  children,
  emptyLabel = "Chart Section",
  contentClassName = "",
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {(title || subtitle) && (
        <div className="flex items-start justify-between">
          <div>
            {title ? <div className="text-sm font-semibold">{title}</div> : null}
            {subtitle ? (
              <div className="text-xs text-base-content/60">{subtitle}</div>
            ) : null}
          </div>
        </div>
      )}

      {children ? (
        <div
          className={`flex-1 min-h-0 rounded-lg border border-primary/20 bg-base-300/40 overflow-auto ${contentClassName}`.trim()}
        >
          {children}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm opacity-70">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
