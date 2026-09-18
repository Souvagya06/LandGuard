import { useId } from 'react'

/**
 * LandGuard brand mark — a 1:1 SVG port of the Android vector drawable
 * `res/drawable/ic_landguard_logo.xml` (shield + mountains + river + satellite).
 */
export function LandGuardLogo({ size = 32, className }: { size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const id = (name: string) => `${name}-${uid}`
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label="LandGuard logo">
      <defs>
        <linearGradient id={id('rim')} gradientUnits="userSpaceOnUse" x1="20" y1="10" x2="70" y2="96">
          <stop offset="0" stopColor="#D7EBC9" />
          <stop offset="0.45" stopColor="#8FD18A" />
          <stop offset="1" stopColor="#3E9F4E" />
        </linearGradient>
        <clipPath id={id('clip')}>
          <path d="M48,14 L77,25 L77,50 C77,70 64,81.5 48,88.5 C32,81.5 19,70 19,50 L19,25 Z" />
        </clipPath>
        <linearGradient id={id('sky')} gradientUnits="userSpaceOnUse" x1="48" y1="14" x2="48" y2="70">
          <stop offset="0" stopColor="#0B1F14" />
          <stop offset="0.55" stopColor="#1F4A2C" />
          <stop offset="1" stopColor="#7FAF5A" />
        </linearGradient>
        <radialGradient id={id('glow')} gradientUnits="userSpaceOnUse" cx="48" cy="44" r="22">
          <stop offset="0" stopColor="#FF8A3D" stopOpacity="0.4" />
          <stop offset="1" stopColor="#FF8A3D" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('sun')} gradientUnits="userSpaceOnUse" x1="48" y1="30" x2="48" y2="56">
          <stop offset="0" stopColor="#FFB25C" />
          <stop offset="1" stopColor="#E8541E" />
        </linearGradient>
        <linearGradient id={id('river')} gradientUnits="userSpaceOnUse" x1="58" y1="61" x2="42" y2="93">
          <stop offset="0" stopColor="#B7DDB0" />
          <stop offset="1" stopColor="#E9F5E3" />
        </linearGradient>
      </defs>
      <path d="M48,7 L80,19 L84,23 L84,50 C84,74 68,88 48,96 C28,88 12,74 12,50 L12,19 Z" fill={`url(#${id('rim')})`} />
      <g clipPath={`url(#${id('clip')})`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${id('sky')})`} />
        <circle cx="48" cy="44" r="22" fill={`url(#${id('glow')})`} />
        <circle cx="48" cy="43" r="12.5" fill={`url(#${id('sun')})`} />
        <path fill="#1E5A32" d="M10,64 L27,47 L35,53 L52,30 L64,45 L71,39 L90,58 L90,100 L10,100 Z" />
        <path fill="#9ED39A" d="M52,30 L45,41 L49,39.5 L50,46 L55,38 L58,42 L64,45 Z" />
        <path fill="#6DBF67" d="M27,47 L22,54 L27,52 L29,55 L35,53 Z" />
        <path fill="#6DBF67" d="M71,39 L68,45 L72,43.5 L76,48 L90,58 Z" />
        <path fill="#2E7D32" d="M10,72 L28,58 L39,66 L55,53 L66,62 L90,54 L90,100 L10,100 Z" />
        <path fill="#4FA254" d="M55,53 L49,59.5 L54,58 L57,63 L66,62 Z" />
        <path fill="#164A28" d="M10,78 C24,71 36,77 50,73 C62,70 74,74 90,70 L90,100 L10,100 Z" />
        <path fill="none" stroke={`url(#${id('river')})`} strokeWidth="5.5" strokeLinecap="round" d="M59,61 C46,64 62,71 49,75 C37,78.5 50,84 41,93" />
      </g>
      <circle cx="78" cy="17" r="12" fill="#0B1F14" />
      <path fill="none" stroke="#E9F5E3" strokeWidth="2.2" strokeLinecap="round" d="M66.5,21.5 A7,7 0,0 0,73.5 28.5" />
      <path fill="none" stroke="#E9F5E3" strokeWidth="2.2" strokeLinecap="round" d="M61.5,21 A12,12 0,0 0,74 33.5" />
      <g transform="rotate(45 80 15)">
        <rect x="76.5" y="11.5" width="7" height="7" fill="#E9F5E3" />
        <path fill="#D7EBC9" d="M69,13h6v4h-6z M85,13h6v4h-6z" />
        <path fill="#E9F5E3" d="M75,14.5h1.5v1h-1.5z M83.5,14.5h1.5v1h-1.5z" />
      </g>
    </svg>
  )
}

/** Android `LandGuardWordmark`: logo on a forest-night tile + "Land"/"Guard" wordmark. */
export function LandGuardWordmark({ compact = false, subtitle }: { compact?: boolean; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex shrink-0 items-center justify-center rounded-[11px] bg-forest-night ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}>
        <LandGuardLogo size={compact ? 26 : 32} />
      </div>
      <div className="min-w-0 leading-none">
        <p className={`font-extrabold tracking-[-0.02em] ${compact ? 'text-[17px]' : 'text-[20px]'}`}>
          <span className="text-ink">Land</span><span className="text-brand-light">Guard</span>
        </p>
        {subtitle && <p className="mt-1 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-3">{subtitle}</p>}
      </div>
    </div>
  )
}

export const LANDGUARD_TAGLINE = 'Safer Lands. Stronger Tomorrows.'
