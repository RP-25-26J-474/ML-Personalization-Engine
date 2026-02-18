import { useId } from "react";

export default function Accordian({ items, name, className = "" }) {
  const autoName = useId();
  const groupName = name || autoName;

  if (!items || items.length === 0) {
    return (
      <div className="text-sm opacity-70 bg-base-100 border border-base-300 rounded p-4">
        No interaction sets yet.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      {items.map((item, index) => (
        <div
          key={item.key || item.title || index}
          className="collapse collapse-arrow bg-base-100 border border-base-300"
        >
          <input type="radio" name={groupName} />
          <div className="collapse-title font-semibold flex flex-col">
            <span>{item.title}</span>
            <span className="text-xs text-base-content/60">{item.subtitle}</span>
          </div>
          <div className="collapse-content text-sm">{item.content}</div>
        </div>
      ))}
    </div>
  );
}
