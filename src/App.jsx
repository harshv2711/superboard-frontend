import { Navigate, Route, Routes } from "react-router-dom";
import AccountPlanningDashboard from "./pages/AccountPlanningDashboard.jsx";
import ArtDirectorDashboard from "./pages/ArtDirectorDashboard.jsx";
import DesignerDashboard from "./pages/DesignerDashboard.jsx";
import "./dashboard.css";

export default function App() {
  return (
    <div className="app-shell">
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/account-planing" replace />} />
          <Route path="/account-planing" element={<AccountPlanningDashboard />} />
          <Route path="/account-planning" element={<Navigate to="/account-planing" replace />} />
          <Route path="/art-director" element={<ArtDirectorDashboard />} />
          <Route path="/designer" element={<DesignerDashboard />} />
          <Route path="*" element={<Navigate to="/account-planing" replace />} />
        </Routes>
      </main>
    </div>
  );
}
