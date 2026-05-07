import { useId, useState } from "react";

export default function NormalTabs({
  tabs,
  defaultIndex = 0,
  name,
  className = "",
  contentClassName = "",
}) {
  const autoName = useId();
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const groupName = name || autoName;

  if (!tabs || tabs.length === 0) {
    return null;
  }

  const activeTab = tabs[activeIndex] || tabs[0];

  return (
    <div className={`flex flex-col ${className}`.trim()}>
      <div className="flex border-b border-base-300 shrink-0" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.key || tab.label || index}
            type="button"
            role="tab"
            name={groupName}
            className={`tab tab-border ${activeIndex === index ? "tab-active" : ""}`}
            aria-label={tab.label}
            onClick={() => setActiveIndex(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={`flex-1 min-h-0 overflow-auto bg-base-100 p-4 ${contentClassName}`.trim()}>
        {activeTab.content}
      </div>
    </div>
  );
}
