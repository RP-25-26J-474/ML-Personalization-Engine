import React, { useMemo, useState } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { logos } from "../assets";
import ThemeButton from "../components/common/ThemeButton";
import BreadCrumbs from "../components/common/BreadCrumbs";
import { FiMenu, FiX } from "react-icons/fi";

import { navSections } from "../constants";

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
  const selectedUserName = location.state?.user?.name?.trim();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

    if (path.startsWith("/admin/users/")) {
      const usersRoute = routeMeta.find((item) => item.to === "/admin/users");
      return [
        { to: usersRoute?.sectionRoot || "/admin/users", label: usersRoute?.sectionLabel || "Operations" },
        { to: "/admin/users", label: usersRoute?.label || "Monitor Users" },
        { to: path, label: "User Profile" },
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
  }, [location.pathname, selectedUserName]);

  const pageName = breadcrumbs[breadcrumbs.length - 1]?.label || "Home";
  const subtitle = (() => {
    const path = location.pathname || "/";
    if (path.startsWith("/admin/users/")) {
      return "Inspect MLPE data and stored profile history for a selected user";
    }
    const parts = path.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1] || "";
    const navItem = navSections
      .flatMap((section) => section.items)
      .find((item) => item.to === `/${lastPart}`);
    return navItem?.subtitle || "";
  })();

  return (
    <div className="h-screen bg-base-300 text-base-content flex overflow-hidden">
      {/* Desktop Sidebar */}
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
              v 1.1.0
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Slide-Over Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Blur backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Drawer content box */}
          <aside className="relative flex w-64 max-w-xs flex-col bg-base-300 border-r border-primary/20 h-full shadow-2xl glass-effect animate-[slideIn_0.25s_cubic-bezier(0.16,1,0.3,1)_forwards]">
            <div className="px-4 py-4 border-b border-primary/20 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                <img src={logos.aura} alt="AURA Logo" className="h-7 w-auto" />
                <div className="flex flex-col font-medium text-start">
                  <span className="font-semibold tracking-tight text-sm">
                    ML Personalization
                  </span>
                  <span className="text-gray-400 text-[10px]">GUI</span>
                </div>
              </Link>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="btn btn-ghost btn-circle btn-sm text-base-content hover:bg-base-200 transition"
                aria-label="Close menu"
              >
                <FiX size={18} />
              </button>
            </div>

            <nav className="flex-1 px-4 py-4 text-sm space-y-1 overflow-y-auto">
              {navSections.map((section) => (
                <div key={section.label}>
                  <SectionLabel label={section.label} />
                  {section.items.map((item) => (
                    <NavItem 
                      key={item.to} 
                      to={item.to} 
                      label={item.label} 
                      onClick={() => setIsMobileMenuOpen(false)} 
                    />
                  ))}
                </div>
              ))}
            </nav>

            <div className="px-4 py-4 border-t border-primary/20 text-xs text-base-content/70">
              <div className="flex items-center justify-between">
                <div>
                  <p>Copyright © {new Date().getFullYear()}</p>
                  <div className="text-[10px]">All right reserved by AURA</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">
                  v 0.0.1
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 border-b border-primary/15 flex items-center justify-between px-4 py-3 bg-base-300/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="btn btn-ghost btn-circle btn-sm md:hidden text-base-content hover:bg-base-200 transition"
              aria-label="Open menu"
            >
              <FiMenu size={20} />
            </button>
            
            <img
              src={logos.aura}
              alt="AURA Logo"
              className="h-7 w-auto md:hidden"
            />
          </div>
          <div className="flex-1 overflow-hidden ml-1 md:ml-0">
            <BreadCrumbs items={breadcrumbs} />
          </div>
          <ThemeButton />
        </header>

         <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gradient-to-b from-base-300 via-base-100 to-base-200">
          <div className="max-w-9xl px-4 md:px-10 py-6 md:py-8 flex-1 flex flex-col min-h-0">
            <div className="flex flex-col sm:flex-row sm:items-center mb-6 justify-between gap-2 shrink-0">
              <div className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-base-content via-base-content/90 to-base-content/70 bg-clip-text text-transparent">
                {pageName}
              </div>
              <div className="text-xs text-base-content/60 max-w-md hidden md:block text-right">
                {subtitle}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SectionLabel({ label }) {
  return (
    <div className="mt-4 mb-1 text-xs uppercase tracking-wider font-semibold text-base-content/40 pl-2">
      {label}
    </div>
  );
}

function NavItem({ to, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-base-200 hover:text-base-content transition text-sm font-medium",
          isActive
            ? "bg-primary/10 text-primary border border-primary/30 border-l-[4px] pl-2.5"
            : "text-base-content/60",
        ].join(" ")
      }
    >
      <span>{label}</span>
    </NavLink>
  );
}

export default MLPersonalizationEngineLayout;
