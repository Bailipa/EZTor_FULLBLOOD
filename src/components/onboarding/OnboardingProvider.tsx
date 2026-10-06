'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useAnalytics } from '@/lib/analytics'

export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

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
  startOnboarding: () => void
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
  const { track } = useAnalytics()
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
      const savedStep = localStorage.getItem('onboarding_step')
      const parsed = savedStep ? Number(savedStep) : NaN
      const resumableStep =
        Number.isInteger(parsed) && parsed >= 1 && parsed <= 8
          ? (parsed as OnboardingStep)
          : null

      if (savedStep && resumableStep === null) {
        localStorage.removeItem('onboarding_step')
      }

      const res = await fetch(
        resumableStep ? '/api/onboarding/status?resume=1' : '/api/onboarding/status',
      )
      if (!res.ok) throw new Error(`Onboarding status request failed (${res.status})`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Onboarding status request failed')

      if (data.success && data.needsOnboarding) {
        const restored = resumableStep ?? (1 as OnboardingStep)

        setState(prev => ({
          ...prev,
          currentStep: restored,
          isActive: true,
          needsOnboarding: true,
          isLoading: false,
        }))
      } else {
        localStorage.removeItem('onboarding_step')
        setState(prev => ({
          ...prev,
          currentStep: 0,
          isActive: false,
          needsOnboarding: false,
          isLoading: false,
        }))
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

      if (next > 8) {
        // 终态：调用 complete API 完成引导（幂等）
        fetch('/api/onboarding/complete', { method: 'POST' }).catch(() => {})
        track('ONBOARDING_COMPLETE', { method: 'guided' })
        localStorage.removeItem('onboarding_step')
        return { ...prev, currentStep: 0, isActive: false, needsOnboarding: false }
      }

      localStorage.setItem('onboarding_step', String(next))
      return { ...prev, currentStep: next }
    })
  }, [track])

  const completeOnboarding = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (response.ok) track('ONBOARDING_COMPLETE', { method: 'manual' })
      localStorage.removeItem('onboarding_step')
      setState({
        currentStep: 0,
        isActive: false,
        needsOnboarding: false,
        isLoading: false,
      })
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
    }
  }, [track])

  const skipOnboarding = useCallback(async () => {
    await completeOnboarding()
  }, [completeOnboarding])

  const startOnboarding = useCallback(() => {
    localStorage.setItem('onboarding_step', '1')
    setState(prev => ({
      ...prev,
      currentStep: 1,
      isActive: true,
      needsOnboarding: true,
    }))
  }, [])

  return (
    <OnboardingContext.Provider
      value={{
        ...state,
        nextStep,
        completeOnboarding,
        skipOnboarding,
        startOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}
