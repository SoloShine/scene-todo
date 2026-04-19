interface SceneTodoLogoProps {
  size?: number
  className?: string
}

export function SceneTodoLogo({ size = 20, className }: SceneTodoLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <defs>
        <linearGradient id="stlg" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-theme)" />
          <stop offset="100%" stopColor="var(--color-theme-light)" />
        </linearGradient>
      </defs>
      {/* Bottom card — deepest */}
      <rect x="3.5" y="5" width="13" height="11" rx="2.5" fill="url(#stlg)" opacity="0.25" />
      {/* Middle card */}
      <rect x="2.5" y="3.5" width="13" height="11" rx="2.5" fill="url(#stlg)" opacity="0.5" />
      {/* Top card */}
      <rect x="1.5" y="2" width="13" height="11" rx="2.5" fill="url(#stlg)" />
      {/* Checkmark */}
      <path
        d="M5.5 8L8 10.5L13 5.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
