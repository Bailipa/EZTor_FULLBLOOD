'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type BrandTheme = 'neutral' | 'purple'

interface BrandThemeContextValue {
  brandTheme: BrandTheme
  setBrandTheme: (theme: BrandTheme) => void
}

const BrandThemeContext = createContext<BrandThemeContextValue>({
  brandTheme: 'purple',
  setBrandTheme: () => {},
})

function getStoredBrand(): BrandTheme {
  if (typeof window === 'undefined') return 'purple'
  const stored = localStorage.getItem('brand-theme')
  if (stored === 'neutral') return 'neutral'
  return 'purple'
}

function applyBrandAttribute(theme: BrandTheme) {
  if (typeof document === 'undefined') return
  if (theme === 'purple') {
    document.documentElement.setAttribute('data-brand-theme', 'purple')
  } else {
    document.documentElement.removeAttribute('data-brand-theme')
  }
}

export function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const [brandTheme, setBrandThemeState] = useState<BrandTheme>('purple')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = getStoredBrand()
    setBrandThemeState(stored)
    applyBrandAttribute(stored)
    setMounted(true)
  }, [])

  const setBrandTheme = useCallback((theme: BrandTheme) => {
    setBrandThemeState(theme)
    localStorage.setItem('brand-theme', theme)
    applyBrandAttribute(theme)
  }, [])

  if (!mounted) {
    return (
      <BrandThemeContext.Provider value={{ brandTheme: 'purple', setBrandTheme }}>
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
