import { Fragment, useId, useState } from "react";

export default function NormalTabs({ tabs, defaultIndex = 0, name, className = "" }) {
  const autoName = useId();
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const groupName = name || autoName;

  if (!tabs || tabs.length === 0) {
    return null;
  }

  return (
    <div className={`tabs tabs-border ${className}`.trim()}>
      {tabs.map((tab, index) => (
        <Fragment key={tab.key || tab.label || index}>
          <input
            type="radio"
            name={groupName}
            className="tab"
            aria-label={tab.label}
            checked={activeIndex === index}
            onChange={() => setActiveIndex(index)}
          />
          <div className="tab-content bg-base-100 border-base-300 p-4">
            {activeIndex === index ? tab.content : null}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
