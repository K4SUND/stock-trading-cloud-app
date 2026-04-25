import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import WalletPage from './pages/WalletPage'
import CompanyDashboardPage from './pages/CompanyDashboardPage'
import AdminPage from './pages/AdminPage'
import MarketsPage from './pages/MarketsPage'

function RoleHome() {
  const { role } = useAuth()
  if (role === 'ROLE_ADMIN')   return <Navigate to="/admin"   replace />
  if (role === 'ROLE_COMPANY') return <Navigate to="/company" replace />
  return <DashboardPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Navbar />
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/"        element={<ProtectedRoute><RoleHome /></ProtectedRoute>} />
        <Route path="/wallet"  element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/markets" element={<ProtectedRoute><MarketsPage /></ProtectedRoute>} />
        <Route path="/company" element={<ProtectedRoute requiredRole="ROLE_COMPANY"><CompanyDashboardPage /></ProtectedRoute>} />
        <Route path="/admin"   element={<ProtectedRoute requiredRole="ROLE_ADMIN"><AdminPage /></ProtectedRoute>} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
