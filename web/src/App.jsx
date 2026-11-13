// The route table (A2 Table 4). All routes are declared once; private routes
// sit inside <ProtectedRoute> and <AppShell>, and every view is lazy-loaded
// so a golfer who only opens the dashboard never downloads the others.
import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import AuthView from './views/AuthView';
import NotFoundView from './views/NotFoundView';

const DashboardView = lazy(() => import('./views/DashboardView'));
const RoundsView = lazy(() => import('./views/RoundsView'));
const RoundDetailView = lazy(() => import('./views/RoundDetailView'));
const ClubsView = lazy(() => import('./views/ClubsView'));
const LeaderboardView = lazy(() => import('./views/LeaderboardView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthView mode="login" />} />
      <Route path="/register" element={<AuthView mode="register" />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardView />} />
        <Route path="rounds" element={<RoundsView />} />
        <Route path="rounds/:roundId" element={<RoundDetailView />} />
        <Route path="clubs" element={<ClubsView />} />
        <Route path="leaderboard" element={<LeaderboardView />} />
        <Route path="settings" element={<SettingsView />} />
      </Route>
      <Route path="*" element={<NotFoundView />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <PreferencesProvider>
          <AppRoutes />
        </PreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
