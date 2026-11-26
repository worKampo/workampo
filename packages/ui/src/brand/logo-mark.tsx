import { useId } from 'react'

type LogoMarkProps = {
  size: number
  /** The app loader's bead, cut into the arc; styles.css animates it. */
  bead?: boolean
}

// docs/design/brand/logo-mono-*.svg in currentColor, so it follows the theme; the text next to it carries the meaning.
export function LogoMark({ size, bead = false }: LogoMarkProps) {
  const mask = `${useId()}-mask`

  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} aria-hidden="true">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
          <rect width="1024" height="1024" fill="white" />
          <path
            d="M355 0 H442 V390 L535 265 H627 L508 428 L640 618 L535 606 L442 478 V630 H355 Z"
            fill="black"
          />
          <circle cx="512" cy="1290" r="663" fill="none" stroke="black" strokeWidth="42" />
          <circle cx="720" cy="512" r="94" fill="black" />
          {bead && <circle className="app-loader-bead" cx="512" cy="627" r="46" fill="black" />}
        </mask>
      </defs>
      <circle cx="512" cy="512" r="340" fill="currentColor" mask={`url(#${mask})`} />
      <circle cx="720" cy="512" r="72" fill="currentColor" />
    </svg>
  )
}
