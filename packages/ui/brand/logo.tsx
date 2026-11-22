import { useId } from 'react'

// docs/design/brand/logo-color.svg inline, next to the name; the name carries the meaning.
export function Logo() {
  const id = useId()
  const mask = `${id}-mask`
  const clip = `${id}-clip`

  return (
    <span className="inline-flex items-center gap-2 text-base font-semibold text-text">
      <svg viewBox="0 0 1024 1024" className="size-8" aria-hidden="true">
        <defs>
          <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
            <rect width="1024" height="1024" fill="white" />
            <path
              d="M355 0 H442 V390 L535 265 H627 L508 428 L640 618 L535 606 L442 478 V630 H355 Z"
              fill="black"
            />
            <circle cx="512" cy="1290" r="663" fill="none" stroke="black" strokeWidth="42" />
          </mask>
          <clipPath id={clip}>
            <circle cx="512" cy="512" r="340" />
          </clipPath>
        </defs>
        <g mask={`url(#${mask})`}>
          <g clipPath={`url(#${clip})`}>
            <rect width="1024" height="1024" fill="#4AACDF" />
            <circle cx="512" cy="1290" r="642" fill="#42843C" />
          </g>
        </g>
        <circle cx="720" cy="512" r="72" fill="#F2760A" />
      </svg>
      worKampo
    </span>
  )
}
