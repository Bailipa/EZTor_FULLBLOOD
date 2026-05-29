'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

interface OnboardingState {
  currentStep: OnboardingStep
  isActive: boolean
  needsOnboarding: boolean
  isLoading: boolean
}

interface OnboardingContextType extends OnboardingState {
  nextStep: () => void
  completeOnboarding: () => Promise<void>
  skipOnboarding: () => Promise<void>
}

const OnboardingContext = createContext<OnboardingContextType | null>(null)

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider')
  }
  return context
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [state, setState] = useState<OnboardingState>({
    currentStep: 0,
    isActive: false,
    needsOnboarding: false,
    isLoading: true,
  })

  const checkOnboardingStatus = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setState(prev => ({ ...prev, isLoading: false }))
      return
    }

    try {
      const res = await fetch('/api/onboarding/status')
      const data = await res.json()

      if (data.success && data.needsOnboarding) {
        setState({
          currentStep: 1,
          isActive: true,
          needsOnboarding: true,
          isLoading: false,
        })
      } else {
        setState({
          currentStep: 0,
          isActive: false,
          needsOnboarding: false,
          isLoading: false,
        })
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [session, status])

  useEffect(() => {
    checkOnboardingStatus()
  }, [checkOnboardingStatus])

  const nextStep = useCallback(() => {
    setState(prev => {
      const next = (prev.currentStep + 1) as OnboardingStep
      if (next > 6) {
        return { ...prev, currentStep: 0, isActive: false }
      }
      return { ...prev, currentStep: next }
    })
  }, [])

  const completeOnboarding = useCallback(async () => {
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' })
      setState({
        currentStep: 0,
        isActive: false,
        needsOnboarding: false,
        isLoading: false,
      })
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
    }
  }, [])

  const skipOnboarding = useCallback(async () => {
    await completeOnboarding()
  }, [completeOnboarding])

  return (
    <OnboardingContext.Provider
      value={{
        ...state,
        nextStep,
        completeOnboarding,
        skipOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}
