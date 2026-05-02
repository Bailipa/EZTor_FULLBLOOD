'use client'

import { useSession } from 'next-auth/react'

export function useAdminCheck() {
  const { data: session, status } = useSession()

  return {
    isLoading: status === 'loading',
    isAdmin: session?.user?.isAdmin === true,
    isAuthenticated: status === 'authenticated',
    status,
  }
}
