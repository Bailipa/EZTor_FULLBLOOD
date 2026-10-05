import type { ReactNode, SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & { size?: number }

function IconFrame({ size = 16, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

export function LightThemeIcon(props: IconProps) {
  return <IconFrame {...props}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></IconFrame>
}

export function DarkThemeIcon(props: IconProps) {
  return <IconFrame {...props}><path d="M19.1 15.1A8.2 8.2 0 0 1 8.9 4.9 8.5 8.5 0 1 0 19.1 15.1Z" /></IconFrame>
}

export function SystemThemeIcon(props: IconProps) {
  return <IconFrame {...props}><rect x="3.5" y="4" width="17" height="12" rx="1.8" /><path d="M8.5 20h7m-3.5-4v4" /></IconFrame>
}

export function NeutralThemeIcon(props: IconProps) {
  return <IconFrame {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" /></IconFrame>
}

export function PurpleThemeIcon(props: IconProps) {
  return <IconFrame {...props}><path d="M12 3.5c-4.7 0-8.5 3.3-8.5 7.4 0 1.5 1.2 2.7 2.7 2.7h1.1c1 0 1.7.9 1.4 1.8-.5 1.5.6 3.1 2.2 3.1 4.4 0 7.6-3.1 7.6-7.2 0-4.3-2.8-7.8-6.5-7.8Z" /><circle cx="7.5" cy="9" r=".8" /><circle cx="11.5" cy="6.8" r=".8" /><circle cx="16" cy="8.5" r=".8" /></IconFrame>
}

export function GoldThemeIcon(props: IconProps) {
  return <IconFrame {...props}><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42m-9.88 9.88-1.42 1.42" /><path d="M12 7.5 16.5 12 12 16.5 7.5 12 12 7.5Z" /></IconFrame>
}

export function IndigoThemeIcon(props: IconProps) {
  return <IconFrame {...props}><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" /><path d="M12 3.5a8.5 8.5 0 0 0 0 17" /><path d="M12 3.5a4.2 4.2 0 0 1 0 8.5 4.2 4.2 0 0 0 0 8.5" /></IconFrame>
}
