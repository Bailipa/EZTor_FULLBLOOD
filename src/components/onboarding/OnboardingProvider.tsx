'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

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
        // 检查是否有保存的步骤
        const savedStep = localStorage.getItem('onboarding_step')
        const parsed = savedStep ? parseInt(savedStep, 10) : NaN
        const restored: OnboardingStep =
          Number.isInteger(parsed) && parsed >= 1 && parsed <= 8
            ? (parsed as OnboardingStep)
            : (() => {
                if (savedStep) localStorage.removeItem('onboarding_step')
                return 1 as OnboardingStep
              })()

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
        localStorage.removeItem('onboarding_step')
        return { ...prev, currentStep: 0, isActive: false, needsOnboarding: false }
      }

      localStorage.setItem('onboarding_step', String(next))
      return { ...prev, currentStep: next }
    })
  }, [])

  const completeOnboarding = useCallback(async () => {
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' })
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
  }, [])

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
