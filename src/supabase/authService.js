import { supabase } from './supabase'

// ─── LOGOUT ────────────────────────────────────────────────
export const logout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) return { success: false, message: error.message }
  return { success: true }
}

// ─── FORGOT PASSWORD (sends reset email) ───────────────────
export const forgotPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  if (error) return { success: false, message: error.message }
  return { success: true, message: 'Password reset email sent' }
}

// ─── RESET PASSWORD (after user clicks email link) ─────────
export const resetPassword = async (newPassword) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })
  if (error) return { success: false, message: error.message }
  return { success: true, message: 'Password updated successfully' }
}

// ─── UPDATE EMAIL ──────────────────────────────────────────
export const updateEmail = async (newEmail) => {
  const { error } = await supabase.auth.updateUser({
    email: newEmail
  })
  if (error) return { success: false, message: error.message }
  return { success: true, message: 'Confirmation sent to both emails' }
}

// ─── UPDATE PASSWORD ───────────────────────────────────────
export const updatePassword = async (newPassword) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })
  if (error) return { success: false, message: error.message }
  return { success: true, message: 'Password updated successfully' }
}

// ─── REDIRECT USER BASED ON ROLE ───────────────────────────
export const redirectByRole = (role, navigate) => {
  if (role === 'admin') navigate('/admin/dashboard')
  else if (role === 'seller') navigate('/seller/dashboard')
  else navigate('/') 
}