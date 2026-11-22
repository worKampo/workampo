import type { ComponentProps } from 'react'
import { cx } from '../lib/cx'

// docs/design/components.md, "Buttons": 36 / 44 high, small 32 / 40, 13 px weight 500, radius 8.
const VARIANTS = {
  primary: 'bg-ui text-on-ui hover:bg-ui-hover',
  secondary: 'border border-border-hard text-text-1b hover:border-text hover:text-text',
  ghost: 'text-text-1 underline underline-offset-4',
  quiet: 'hover:bg-nav-hover',
  danger: 'bg-neg text-on-neg',
}

const SIZES = {
  default: 'h-9 px-4 pointer-coarse:h-11',
  small: 'h-8 px-3 pointer-coarse:h-10',
}

type ButtonStyle = {
  variant?: keyof typeof VARIANTS | undefined
  size?: keyof typeof SIZES | undefined
}

export function buttonClassName({ variant = 'primary', size = 'default' }: ButtonStyle = {}) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg text-[13px] font-medium',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui',
    'disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-3',
    VARIANTS[variant],
    SIZES[size],
  )
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & ButtonStyle) {
  return (
    <button type={type} className={cx(buttonClassName({ variant, size }), className)} {...props} />
  )
}
