import { NavLink } from "react-router-dom";
import {
  BriefcaseBusiness,
  Brush,
  Home,
  Search,
  Sun,
} from "lucide-react";

const sidebarItems = [
  { label: "Account & Planing", icon: Home, to: "/account-planing" },
  { label: "Art Director", icon: BriefcaseBusiness, to: "/art-director" },
  { label: "Designer", icon: Brush, to: "/designer" },
];

export default function AppSidebar() {
  return (
    <aside className="sb-shell" aria-label="Sidebar">
      <div className="sb-rail">
        <div className="sb-logo">
          <Sun size={20} strokeWidth={2.2} />
        </div>
        <div className="sb-rail-items">
          {sidebarItems.map((item) => (
            <NavLink key={item.label} to={item.to} className={({ isActive }) => `sb-rail-btn ${isActive ? "is-active" : ""}`} aria-label={item.label}>
              <item.icon size={18} />
            </NavLink>
          ))}
        </div>
      </div>

      <div className="sb-panel">
        <h2>Overview</h2>

        <div className="sb-search">
          <Search size={16} />
          <input type="text" placeholder="Search dashboards" />
        </div>

        <nav className="sb-nav" aria-label="Primary">
          {sidebarItems.map((item) => (
            <NavLink key={item.label} to={item.to} className={({ isActive }) => `sb-nav-row ${isActive ? "is-route-active" : ""}`}>
              <span className="sb-left">
                <item.icon size={18} />
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
