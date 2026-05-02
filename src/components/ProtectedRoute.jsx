import { Navigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, profile, loading } = useAuthContext()

  // Still fetching user data → show nothing yet
  if (loading) return <div>Loading...</div>

  // Not logged in → redirect to home
  if (!user) return <Navigate to="/" />

  // Role check → if allowedRole is provided
  if (allowedRole && profile?.role !== allowedRole) {
    return <Navigate to="/" />
  }

  // All checks passed → show the page
  return children
}

export default ProtectedRoute;