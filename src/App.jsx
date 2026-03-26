import { Navigate, Route, Routes } from "react-router-dom";
import { superboardApi } from "./api/superboardApi.js";
import ClientsPage from "./pages/ClientsPage.jsx";
import ClientsWorkPage from "./pages/ClientsWorkPage.jsx";
import DailyTaskPage from "./pages/DailyTaskPage.jsx";
import DeliverablesTrackerPage from "./pages/DeliverablesTrackerPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import DesignerKpiPage from "./pages/DesignerKpiPage.jsx";
import BrandKpiPage from "./pages/BrandKpiPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NegativeRemarksPage from "./pages/NegativeRemarksPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import TypeOfWorkPage from "./pages/TypeOfWorkPage.jsx";
import WelcomePage from "./pages/WelcomePage.jsx";

function isAuthenticated() {
  return Boolean(superboardApi.auth.getToken());
}

function getDefaultRouteForRole(role) {
  if (role === "superuser") return "/account-planing";
  if (role === "account_planner") return "/account-planing";
  if (role === "art_director") return "/art-director";
  if (role === "designer") return "/designer";
  return "/account-planing";
}

function getStoredRole() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("superboard_auth_user");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed?.role || "";
  } catch {
    return "";
  }
}

function RequireAuth({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function RequireRole({ allowedRoles, children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const role = getStoredRole();
  if (role === "superuser") return children;
  return allowedRoles.includes(role) ? children : <Navigate to={getDefaultRouteForRole(role)} replace />;
}

function RedirectIfAuthenticated({ children }) {
  return isAuthenticated() ? <Navigate to={getDefaultRouteForRole(getStoredRole())} replace /> : children;
}

export default function App() {
  const defaultRoute = getDefaultRouteForRole(getStoredRole());

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated() ? defaultRoute : "/login"} replace />} />
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthenticated>
            <RegisterPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <AccountPage />
          </RequireAuth>
        }
      />
      <Route
        path="/account-planing"
        element={
          <RequireAuth>
            <WelcomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/account-planing/clients"
        element={
          <RequireAuth>
            <ClientsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/account-planing/daily-task"
        element={
          <RequireAuth>
            <DailyTaskPage />
          </RequireAuth>
        }
      />
      <Route
        path="/account-planing/clients-work"
        element={
          <RequireAuth>
            <ClientsWorkPage />
          </RequireAuth>
        }
      />
      <Route
        path="/account-planing/type-of-work"
        element={
          <RequireRole allowedRoles={["superuser", "art_director"]}>
            <TypeOfWorkPage />
          </RequireRole>
        }
      />
      <Route
        path="/account-planing/negative-remarks"
        element={
          <RequireRole allowedRoles={["superuser", "art_director"]}>
            <NegativeRemarksPage />
          </RequireRole>
        }
      />
      <Route path="/account-planning" element={<Navigate to="/account-planing" replace />} />
      <Route path="/account-planning/daily-task" element={<Navigate to="/account-planing/daily-task" replace />} />
      <Route path="/account-planning/clients" element={<Navigate to="/account-planing/clients" replace />} />
      <Route path="/account-planning/clients-work" element={<Navigate to="/account-planing/clients-work" replace />} />
      <Route path="/account-planning/type-of-work" element={<Navigate to="/account-planing/type-of-work" replace />} />
      <Route path="/account-planning/negative-remarks" element={<Navigate to="/account-planing/negative-remarks" replace />} />
      <Route
        path="/art-director"
        element={
          <RequireAuth>
            <WelcomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/art-director/daily-task"
        element={
          <RequireRole allowedRoles={["art_director"]}>
            <DailyTaskPage />
          </RequireRole>
        }
      />
      <Route
        path="/art-director/task-manager"
        element={
          <RequireRole allowedRoles={["art_director"]}>
            <ClientsWorkPage headerTitle="Task Manager" />
          </RequireRole>
        }
      />
      <Route path="/art-director/clients-work" element={<Navigate to="/art-director/task-manager" replace />} />
      <Route
        path="/art-director/type-of-work"
        element={
          <RequireRole allowedRoles={["art_director"]}>
            <TypeOfWorkPage />
          </RequireRole>
        }
      />
      <Route
        path="/art-director/negative-remarks"
        element={
          <RequireRole allowedRoles={["art_director"]}>
            <NegativeRemarksPage />
          </RequireRole>
        }
      />
      <Route
        path="/designer"
        element={
          <RequireAuth>
            <WelcomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/designer/clients-work"
        element={
          <RequireRole allowedRoles={["designer"]}>
            <ClientsWorkPage headerTitle="Designer" />
          </RequireRole>
        }
      />
      <Route
        path="/designer/daily-task"
        element={
          <RequireRole allowedRoles={["designer"]}>
            <DailyTaskPage />
          </RequireRole>
        }
      />
      <Route
        path="/reports/deliverables-tracker"
        element={
          <RequireAuth>
            <DeliverablesTrackerPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports/designer-kpi"
        element={
          <RequireAuth>
            <DesignerKpiPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports/brand-kpi"
        element={
          <RequireRole allowedRoles={["superuser"]}>
            <BrandKpiPage />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated() ? defaultRoute : "/login"} replace />} />
    </Routes>
  );
}
