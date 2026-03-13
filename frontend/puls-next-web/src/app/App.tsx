import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ToastViewport } from '../components/ToastViewport';
import { LoginPage } from '../pages/LoginPage';

const AppShell = lazy(() => import('../components/AppShell').then((module) => ({ default: module.AppShell })));
const DashboardPage = lazy(() => import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const EmployeesPage = lazy(() => import('../pages/EmployeesPage').then((module) => ({ default: module.EmployeesPage })));
const OrganizationsPage = lazy(() => import('../pages/OrganizationsPage').then((module) => ({ default: module.OrganizationsPage })));
const CampaignsPage = lazy(() => import('../pages/CampaignsPage').then((module) => ({ default: module.CampaignsPage })));
const CampaignEditPage = lazy(() => import('../pages/CampaignEditPage').then((module) => ({ default: module.CampaignEditPage })));
const TransportProfilesPage = lazy(() => import('../pages/TransportProfilesPage').then((module) => ({ default: module.TransportProfilesPage })));

function ShellLayout() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="page page-center">Загрузка...</div>}>
        <AppShell>
          <Outlet />
        </AppShell>
      </Suspense>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ShellLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/campaigns/new" element={<CampaignEditPage />} />
            <Route path="/campaigns/:id" element={<CampaignEditPage />} />
            <Route path="/settings" element={<TransportProfilesPage />} />
            <Route path="/transport-profiles" element={<Navigate to="/settings" replace />} />
            <Route path="/work" element={<Navigate to="/" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastViewport />
    </>
  );
}
