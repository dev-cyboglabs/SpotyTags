import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { AuthProvider } from "./lib/auth";
import { RealtimeProvider } from "./lib/realtime";
import { LicenseProvider } from "./lib/license";
import { CurrencyProvider } from "./lib/currency";
import { BrandingProvider } from "./lib/branding";
import { Toaster } from "./components/ui/sonner";

/**
 * When the React bundle runs inside the Capacitor Android shell, send the
 * user straight to /mobile-app-info so the staff app never shows the dashboard.
 */
function NativeMobileRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const p = location.pathname;
    const isMobilePath = p.startsWith("/mobile-app-info") || p === "/login";
    if (!isMobilePath) navigate("/mobile-app-info", { replace: true });
  }, [location.pathname, navigate]);
  return null;
}

import ProtectedRoute from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Rooms from "./pages/Rooms";
import Tags from "./pages/Tags";
import Gateways from "./pages/Gateways";
import Products from "./pages/Products";
import Billing from "./pages/Billing";
import Housekeeping from "./pages/Housekeeping";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import LicensePage from "./pages/License";
import Settings from "./pages/Settings";
import AuditLogs from "./pages/AuditLogs";
import FrontDesk from "./pages/FrontDesk";
import SuperAdmin from "./pages/SuperAdmin";
import MobileAppInfo from "./pages/MobileAppInfo";
import MobileAppDownload from "./pages/MobileAppDownload";
import LicenseExpiryModal from "./components/LicenseExpiryModal";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <BrandingProvider>
        <AuthProvider>
          <RealtimeProvider>
            <LicenseProvider>
              <CurrencyProvider>
              <NativeMobileRedirect />
              <LicenseExpiryModal />
              <Routes>
              <Route path="/login" element={<Login />} />

              {/* Desktop dashboard */}
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="/front-desk" element={<ProtectedRoute allowedRoles={["super_admin", "hotel_admin", "reception"]}><FrontDesk /></ProtectedRoute>} />
                <Route path="/rooms" element={<Rooms />} />
                <Route path="/tags" element={<Tags />} />
                <Route path="/gateways" element={<Gateways />} />
                <Route path="/products" element={<Products />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/housekeeping" element={<Housekeeping />} />
                <Route path="/mobile-app-info" element={<MobileAppInfo />} />
                <Route path="/mobile-app-download" element={<MobileAppDownload />} />
                <Route path="/reports" element={<ProtectedRoute allowedRoles={["super_admin", "hotel_admin"]}><Reports /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute allowedRoles={["super_admin", "hotel_admin"]}><Users /></ProtectedRoute>} />
                <Route path="/license" element={<ProtectedRoute allowedRoles={["super_admin", "hotel_admin"]}><LicensePage /></ProtectedRoute>} />
                <Route path="/audit" element={<ProtectedRoute allowedRoles={["super_admin", "hotel_admin"]}><AuditLogs /></ProtectedRoute>} />
                <Route path="/settings" element={<Settings />} />
                {/* Local Super Admin — branding & deployment */}
                <Route path="/super-admin" element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdmin /></ProtectedRoute>} />
              </Route>
            </Routes>
            <Toaster position="bottom-right" closeButton />
              </CurrencyProvider>
            </LicenseProvider>
          </RealtimeProvider>
        </AuthProvider>
        </BrandingProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
