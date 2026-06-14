'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

interface OnboardingState {
  currentStep: OnboardingStep
  isActive: boolean
  needsOnboarding: boolean
  isLoading: boolean
  isMobile: boolean
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
    isMobile: false,
  })

  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      setState(prev => ({ ...prev, isMobile: window.innerWidth < 1280 }))
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
        const currentStep = savedStep ? parseInt(savedStep, 10) : 1
        
        setState(prev => ({
          ...prev,
          currentStep: currentStep as OnboardingStep,
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
      let next = (prev.currentStep + 1) as OnboardingStep
      
      // 桌面端跳过步骤5（反馈聊天介绍）
      if (!prev.isMobile && next === 5) {
        next = 6
      }
      
      if (next > 6) {
        localStorage.removeItem('onboarding_step')
        return { ...prev, currentStep: 0, isActive: false }
      }
      
      // 保存当前步骤到 localStorage
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
        isMobile: false,
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
