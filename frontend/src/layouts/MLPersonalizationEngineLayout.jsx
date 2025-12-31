import React, { useMemo } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { logos } from "../assets";
import ThemeButton from "../components/common/ThemeButton";
import BreadCrumbs from "../components/common/BreadCrumbs";

const navSections = [
  {
    label: "Platform",
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        subtitle: "Overview of the ML Personalization Engine",
      },
      {
        to: "/temporary-user-detector",
        label: "Temporary User Detector",
        subtitle: "Manage temporary user detection settings",
      },
      {
        to: "/category-engine",
        label: "Category Personalization Engine",
        subtitle: "Configure category-based recommendations",
      },
      {
        to: "/user-engine",
        label: "User Personalization Engine",
        subtitle: "Manage user-based recommendations",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/train", label: "Train Models", subtitle: "Train personalization models" },
      { to: "/pipelines", label: "Pipelines", subtitle: "Manage data pipelines" },
      { to: "/monitoring", label: "Monitoring", subtitle: "Monitor system performance" },
      { to: "/settings", label: "Settings", subtitle: "Configure system settings" },
    ],
  },
];

const pathLabelMap = navSections.reduce(
  (acc, section) => {
    section.items.forEach((item) => {
      acc[item.to] = item.label;
    });
    return acc;
  },
  { "/": "Home" }
);

const routeMeta = navSections.flatMap((section) =>
  section.items.map((item) => ({
    ...item,
    sectionLabel: section.label,
    sectionRoot: section.items[0]?.to || "/",
  }))
);

function humanizeSegment(segment) {
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function MLPersonalizationEngineLayout() {
  const location = useLocation();

  const breadcrumbs = useMemo(() => {
    const path = location.pathname || "/";
    if (path === "/") {
      return [{ to: "/", label: "Home" }];
    }

    const match = routeMeta.find((item) => item.to === path);
    if (match) {
      return [
        { to: match.sectionRoot, label: match.sectionLabel },
        { to: match.to, label: match.label },
      ];
    }

    const parts = path.split("/").filter(Boolean);
    const items = [{ to: "/", label: "Home" }];
    let current = "";

    parts.forEach((part) => {
      current += `/${part}`;
      items.push({
        to: current,
        label: pathLabelMap[current] || humanizeSegment(part),
      });
    });

    return items;
  }, [location.pathname]);

  const pageName = breadcrumbs[breadcrumbs.length - 1]?.label || "Home";
  const subtitle = (() => {
    const path = location.pathname || "/";
    const parts = path.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1] || "";
    const navItem = navSections
      .flatMap((section) => section.items)
      .find((item) => item.to === `/${lastPart}`);
    return navItem?.subtitle || "";
  })();

  return (
    <div className="min-h-screen bg-base-300 text-base-content flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-primary/20 bg-base-300">
        <div className="px-4 py-4 border-b border-primary/20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logos.aura} alt="AURA Logo" className="h-7 w-auto" />
            <div className="flex flex-col font-medium text-start">
              <span className="font-semibold tracking-tight text-sm">
                ML Personalization Engine
              </span>
              <span className="text-gray-400 text-xs">GUI</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 text-sm space-y-1">
          {navSections.map((section) => (
            <div key={section.label}>
              <SectionLabel label={section.label} />
              {section.items.map((item) => (
                <NavItem key={item.to} to={item.to} label={item.label} />
              ))}
            </div>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-primary/20 text-xs text-base-content/70">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-base-content truncate">
                <p>Copyright © {new Date().getFullYear()}</p>
                <div className="text-xs">All right reserved by AURA</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs border border-cyan-500/30">
              v 0.0.1
            </span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col max-h-screen overflow-auto">
        <header className="sticky border-b-3 border-primary/90 flex items-center justify-between px-4 py-3 bg-base-300">
          <img
            src={logos.aura}
            alt="AURA Logo"
            className="h-7 w-auto md:hidden"
          />
          <BreadCrumbs items={breadcrumbs} />
          <ThemeButton />
        </header>

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-base-300 via-base-100 to-base-200">
          <div className="max-w-7xl mx-auto px-10 py-8">
            <div className="flex flex-row items-center mb-6 justify-between">
              <div className="text-2xl font-semibold">{pageName}</div>
              <div className="text-xs text-base-content/60 hidden md:block">{subtitle}</div>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SectionLabel({ label }) {
  return (
    <div className="mt-4 mb-1 text-xs uppercase tracking-wide text-base-content/60">
      {label}
    </div>
  );
}

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-base-300 hover:text-base-content transition text-sm",
          isActive
            ? "bg-primary/15 text-base-content border border-primary/70 border-l-6 pl-2"
            : "text-base-content/50",
        ].join(" ")
      }
    >
      <span>{label}</span>
    </NavLink>
  );
}

export default MLPersonalizationEngineLayout;
