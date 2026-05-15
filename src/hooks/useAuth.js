import { useState, useEffect } from 'react'
import { supabase } from '../supabase/supabase'

export const useAuth = () => {

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {

    if (!userId) {
      setProfile(null)
      return
    }

    try {

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Profile fetch error:', error)
        setProfile(null)
        return
      }

      setProfile(data)

    } catch (err) {
      console.error(err)
      setProfile(null)
    }
  }

  useEffect(() => {

    let mounted = true

    const initializeAuth = async () => {

      try {

        const {
          data: { session }
        } = await supabase.auth.getSession()

        const currentUser = session?.user ?? null

        if (!mounted) return

        setUser(currentUser)

        if (currentUser) {
          await fetchProfile(currentUser.id)
        } else {
          setProfile(null)
        }

      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_, session) => {

      const currentUser = session?.user ?? null

      setUser(currentUser)

      if (currentUser) {
        await fetchProfile(currentUser.id)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }

  }, [])

  return {
    user,
    profile,
    loading
  }
}