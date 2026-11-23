import type { ComponentProps } from 'react'
import { cx } from '../_shared/cx'

const SIZES = { sm: 'text-sm', xs: 'text-xs' }
const TONES = { default: 'text-text-1', muted: 'text-text-2', negative: 'text-neg' }
const ALIGNS = { start: 'text-start', center: 'text-center' }

// Body text on the token scale, so screens carry no typography classes.
export function Text({
  size = 'sm',
  tone = 'default',
  align = 'start',
  className,
  ...props
}: ComponentProps<'p'> & {
  size?: keyof typeof SIZES
  tone?: keyof typeof TONES
  align?: keyof typeof ALIGNS
}) {
  return <p className={cx(SIZES[size], TONES[tone], ALIGNS[align], className)} {...props} />
}
