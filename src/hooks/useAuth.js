import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/supabase'

export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const isInitializing = useRef(true)  // ← useRef persists across renders

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
    setProfile(data || null)
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
      isInitializing.current = true  // ← use .current

      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user ?? null

      if (!mounted) return

      setUser(currentUser)
      if (currentUser) await fetchProfile(currentUser.id)
      else setProfile(null)

      setLoading(false)
      setInitialized(true)
      isInitializing.current = false  // ← use .current
    }

    init()

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (isInitializing.current) return  // ← use .current
        if (event === 'PASSWORD_RECOVERY') return
        if (event === 'INITIAL_SESSION') return

        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) await fetchProfile(currentUser.id)
        else setProfile(null)
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