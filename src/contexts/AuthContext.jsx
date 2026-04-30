import { createContext, useContext } from 'react'
import { useAuth } from '../hooks/useAuth'

// Create the context
const AuthContext = createContext(null)

// Provider — wraps your entire app and shares auth data
export const AuthProvider = ({ children }) => {
  const auth = useAuth() // useAuth called ONCE here only

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to access auth data anywhere
export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}