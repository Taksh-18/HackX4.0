import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider } from './context/RoleContext';
import { useRole } from './context/RoleContext';
import { IncidentProvider } from './context/IncidentContext';
import { ResponderLayout } from './components/layout/ResponderLayout';
import { LoadingState } from './components/ui/LoadingState';

// CHANGED: preserve the route tree while loading each screen only when visited.
const HomePage = lazy(() =>
  import('./pages/citizen/HomePage').then(module => ({ default: module.HomePage }))
);
const MapPage = lazy(() =>
  import('./pages/citizen/MapPage').then(module => ({ default: module.MapPage }))
);
const ReportPage = lazy(() =>
  import('./pages/citizen/ReportPage').then(module => ({ default: module.ReportPage }))
);
const MyReportsPage = lazy(() =>
  import('./pages/citizen/MyReportsPage').then(module => ({ default: module.MyReportsPage }))
);
const IncidentDetailPage = lazy(() =>
  import('./pages/citizen/IncidentDetailPage').then(module => ({
    default: module.IncidentDetailPage,
  }))
);
const DashboardPage = lazy(() =>
  import('./pages/responder/DashboardPage').then(module => ({ default: module.DashboardPage }))
);
const ResponderMapPage = lazy(() =>
  import('./pages/responder/MapPage').then(module => ({ default: module.ResponderMapPage }))
);
const FeedPage = lazy(() =>
  import('./pages/responder/FeedPage').then(module => ({ default: module.FeedPage }))
);
const ResponderIncidentDetailPage = lazy(() =>
  import('./pages/responder/IncidentDetailPage').then(module => ({
    default: module.IncidentDetailPage,
  }))
);
const ReportsPage = lazy(() =>
  import('./pages/responder/ReportsPage').then(module => ({ default: module.ReportsPage }))
);
const AnalyticsPage = lazy(() =>
  import('./pages/responder/AnalyticsPage').then(module => ({ default: module.AnalyticsPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/responder/SettingsPage').then(module => ({ default: module.SettingsPage }))
);

// CHANGED: demo-mode route guard. Real authorization still belongs on the API.
function RequireResponder({ children }: { children: ReactNode }) {
  const { isResponder } = useRole();
  return isResponder ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <RoleProvider>
        <IncidentProvider>
          <Suspense fallback={<LoadingState className="p-6" />}>
            <Routes>
              {/* Citizen routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/reports" element={<MyReportsPage />} />
              <Route path="/incidents/:id" element={<IncidentDetailPage />} />

              {/* Responder routes (with sidebar layout) */}
              <Route
                path="/responder"
                element={
                  <RequireResponder>
                    <ResponderLayout />
                  </RequireResponder>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="map" element={<ResponderMapPage />} />
                <Route path="feed" element={<FeedPage />} />
                <Route path="incidents/:id" element={<ResponderIncidentDetailPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </IncidentProvider>
      </RoleProvider>
    </BrowserRouter>
  );
}
