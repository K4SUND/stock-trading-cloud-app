import React, { createContext, useContext, useState, useCallback } from 'react'
import { userApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [user,  setUser]  = useState(() => JSON.parse(localStorage.getItem('user') || 'null'))

  const login = useCallback(async (credentials) => {
    const res = await userApi.post('/login', credentials)
    const { token, userId, username, role } = res.data
    setToken(token)
    setUser({ userId, username, role })
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify({ userId, username, role }))
  }, [])

  const register = useCallback(async (credentials) => {
    await userApi.post('/register', credentials)
  }, [])

  const logout = useCallback(() => {
    setToken('')
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }, [])

  return (
    <AuthContext.Provider value={{
      token, user, login, logout, register,
      isLoggedIn: !!token && !!user,
      role: user?.role || null,
      isAdmin:   user?.role === 'ROLE_ADMIN',
      isCompany: user?.role === 'ROLE_COMPANY',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
