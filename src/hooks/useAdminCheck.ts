'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useAdminCheck() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && !session?.user?.isAdmin) {
      router.push('/');
    }
  }, [status, session, router]);

  return {
    isLoading: status === 'loading',
    isAdmin: session?.user?.isAdmin === true,
    isAuthenticated: status === 'authenticated',
  };
}
