'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type BrandTheme = 'neutral' | 'purple' | 'gold' | 'indigo'

interface BrandThemeContextValue {
  brandTheme: BrandTheme
  setBrandTheme: (theme: BrandTheme) => void
}

const BrandThemeContext = createContext<BrandThemeContextValue>({
  brandTheme: 'indigo',
  setBrandTheme: () => {},
})

function getStoredBrand(): BrandTheme {
  if (typeof window === 'undefined') return 'indigo'
  try {
    const stored = localStorage.getItem('brand-theme')
    if (stored === 'purple' || stored === 'gold' || stored === 'indigo') return stored
  } catch {
    // Storage may be unavailable; the current page can still use its theme.
  }
  return 'indigo'
}

function applyBrandAttribute(theme: BrandTheme) {
  if (typeof document === 'undefined') return
  if (theme === 'neutral') {
    document.documentElement.removeAttribute('data-brand-theme')
  } else {
    document.documentElement.setAttribute('data-brand-theme', theme)
  }
}

export function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const [brandTheme, setBrandThemeState] = useState<BrandTheme>('indigo')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = getStoredBrand()
    setBrandThemeState(stored)
    applyBrandAttribute(stored)
    setMounted(true)
  }, [])

  const setBrandTheme = useCallback((theme: BrandTheme) => {
    setBrandThemeState(theme)
    try {
      localStorage.setItem('brand-theme', theme)
    } catch {
      // Apply the selection for this page even when persistence is unavailable.
    }
    applyBrandAttribute(theme)
  }, [])

  if (!mounted) {
    return (
      <BrandThemeContext.Provider value={{ brandTheme: 'indigo', setBrandTheme }}>
        {children}
      </BrandThemeContext.Provider>
    )
  }

  return (
    <BrandThemeContext.Provider value={{ brandTheme, setBrandTheme }}>
      {children}
    </BrandThemeContext.Provider>
  )
}

export function useBrandTheme() {
  return useContext(BrandThemeContext)
}
