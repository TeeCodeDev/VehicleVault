import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { LanguageProvider } from './context/LanguageContext.js';

import { Layout } from './components/Layout.js';
import { Dashboard } from './pages/Dashboard.js';
import { Vehicles } from './pages/Vehicles.js';
import { FuelLog } from './pages/FuelLog.js';
import { Maintenance } from './pages/Maintenance.js';
import { Documents } from './pages/Documents.js';
import { AnalyticsTco } from './pages/AnalyticsTco.js';
import { Settings } from './pages/Settings.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-xs text-slate-500 font-mono">
        VehicleVault laden...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="vehicles" element={<Vehicles />} />
                <Route path="fuel" element={<FuelLog />} />
                <Route path="maintenance" element={<Maintenance />} />
                <Route path="documents" element={<Documents />} />
                <Route path="analytics" element={<AnalyticsTco />} />
                <Route path="import" element={<Navigate to="/settings?tab=import" replace />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

