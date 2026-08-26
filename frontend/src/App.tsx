import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage.tsx';
import PublicMapPage from './pages/PublicMapPage.tsx';
import RequestFormPage from './pages/RequestFormPage.tsx';
import TrackPage from './pages/TrackPage.tsx';
import AdminLoginPage from './pages/admin/AdminLoginPage.tsx';
import AdminLayout from './pages/admin/AdminLayout.tsx';
import AdminRoomsPage from './pages/admin/AdminRoomsPage.tsx';
import AdminRequestsPage from './pages/admin/AdminRequestsPage.tsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.tsx';
import AdminFloorPage from './pages/admin/AdminFloorPage.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/map" element={<PublicMapPage />} />
      <Route path="/sewa/:roomId" element={<RequestFormPage />} />
      <Route path="/tracking" element={<TrackPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="rooms" element={<AdminRoomsPage />} />
        <Route path="floor" element={<AdminFloorPage />} />
        <Route path="requests" element={<AdminRequestsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}