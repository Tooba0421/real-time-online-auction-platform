import { createContext, useContext } from 'react'
import { useAuth } from '../hooks/useAuth'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {

  const {
    user,
    profile,
    loading,
    setProfile,        // ✅ expose setter
    refreshProfile     // ✅ new function (important)
  } = useAuth()

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      setProfile,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}