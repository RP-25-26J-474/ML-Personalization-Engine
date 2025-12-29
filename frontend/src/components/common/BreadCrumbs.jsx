import React from "react";
import { Link } from "react-router-dom";

function BreadCrumbs({ items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="hidden md:block breadcrumbs text-xs">
      <ul>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.to}-${item.label}`}>
              {isLast ? item.label : <Link to={item.to}>{item.label}</Link>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default BreadCrumbs;
