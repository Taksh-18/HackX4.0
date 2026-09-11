import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider } from './context/RoleContext';
import { IncidentProvider } from './context/IncidentContext';

import { ResponderLayout } from './components/layout/ResponderLayout';

// Citizen pages
import { HomePage } from './pages/citizen/HomePage';
import { MapPage } from './pages/citizen/MapPage';
import { ReportPage } from './pages/citizen/ReportPage';
import { MyReportsPage } from './pages/citizen/MyReportsPage';
import { IncidentDetailPage } from './pages/citizen/IncidentDetailPage';

// Responder pages
import { DashboardPage } from './pages/responder/DashboardPage';
import { ResponderMapPage } from './pages/responder/MapPage';
import { FeedPage } from './pages/responder/FeedPage';
import { IncidentDetailPage as ResponderIncidentDetailPage } from './pages/responder/IncidentDetailPage';
import { ReportsPage } from './pages/responder/ReportsPage';
import { AnalyticsPage } from './pages/responder/AnalyticsPage';
import { SettingsPage } from './pages/responder/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <RoleProvider>
        <IncidentProvider>
          <Routes>
            {/* Citizen routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/reports" element={<MyReportsPage />} />
            <Route path="/incidents/:id" element={<IncidentDetailPage />} />

            {/* Responder routes (with sidebar layout) */}
            <Route path="/responder" element={<ResponderLayout />}>
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
        </IncidentProvider>
      </RoleProvider>
    </BrowserRouter>
  );
}
