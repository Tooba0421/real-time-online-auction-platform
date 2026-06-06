import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/supabase'
import toast from 'react-hot-toast'

export const useAuth = () => {
  const [user, setUser]               = useState(null)
  const [profile, setProfile]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [initialized, setInitialized] = useState(false)
  const isInitializing                = useRef(true)

  // ── Fetch profile and check ban status ────────────────────────────
  // Returns the profile data, or null if user was banned and signed out
  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!data) {
      setProfile(null)
      return null
    }

    // FIX: Check ban status for all roles EXCEPT admin
    // Admin accounts are never banned so we skip the check for them
    if (data.role !== 'admin' && data.status === 'banned') {
      // Sign out the banned user immediately
      await supabase.auth.signOut()

      // Clear state
      setUser(null)
      setProfile(null)

      // Show toast message — use setTimeout so it fires after state clears
      setTimeout(() => {
        toast.error(
          'Your account has been suspended. Please contact support.',
          { duration: 5000 }
        )
      }, 100)

      return null
    }

    setProfile(data)
    return data
  }

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await fetchProfile(session.user.id)
    }
  }

  useEffect(() => {
    let mounted = true

    if (window.location.pathname === '/reset-password') {
      setLoading(false)
      setInitialized(true)
      return
    }

    const init = async () => {
      setLoading(true)
      isInitializing.current = true

      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user ?? null

      if (!mounted) return

      setUser(currentUser)

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id)
        // If fetchProfile returned null due to ban, user is already signed out
        // setUser(null) was called inside fetchProfile, so we sync here too
        if (!profileData && currentUser) {
          setUser(null)
        }
      } else {
        setProfile(null)
      }

      setLoading(false)
      setInitialized(true)
      isInitializing.current = false
    }

    init()

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (isInitializing.current) return
        if (event === 'PASSWORD_RECOVERY') return
        if (event === 'INITIAL_SESSION') return

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          const profileData = await fetchProfile(currentUser.id)
          // If banned — fetchProfile already signed them out and cleared state
          if (!profileData) setUser(null)
        } else {
          setProfile(null)
        }

        setLoading(false)
      })

    const handleStorageChange = (e) => {
      if (e.key?.includes('auth-token')) init()
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      mounted = false
      subscription.unsubscribe()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return {
    user,
    profile,
    loading: loading || !initialized,
    setProfile,
    refreshProfile
  }
}