import { avatarColourSlot, avatarInitials } from '@workampo/domain/_shared/avatar'
import { cx } from '../_shared/cx'

// Whole class names, so Tailwind finds them; the order is the palette slot.
const COLOURS = [
  'bg-avatar-1-bg text-avatar-1-fg',
  'bg-avatar-2-bg text-avatar-2-fg',
  'bg-avatar-3-bg text-avatar-3-fg',
  'bg-avatar-4-bg text-avatar-4-fg',
  'bg-avatar-5-bg text-avatar-5-fg',
  'bg-avatar-6-bg text-avatar-6-fg',
]

// docs/design/components.md, "Avatars": the shape comes from the kind.
const SHAPES = {
  person: { md: 'size-8 rounded-full text-avatar', lg: 'size-12 rounded-full text-avatar-lg' },
  company: { md: 'size-8 rounded-lg text-xs', lg: 'size-12 rounded-xl text-base' },
}

// Always decorative: the name next to it, or the label of the button around it, carries the meaning.
export function Avatar({
  kind,
  name,
  email,
  size = 'md',
}: {
  kind: keyof typeof SHAPES
  name?: string | undefined
  email?: string | undefined
  size?: 'md' | 'lg'
}) {
  const initials = avatarInitials({ name, email })
  const colour = initials
    ? COLOURS[avatarColourSlot({ initials, slots: COLOURS.length })]
    : 'bg-muted text-text-2'

  return (
    <span
      aria-hidden="true"
      data-kind={kind}
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-semibold select-none',
        SHAPES[kind][size],
        colour,
      )}
    >
      {initials ?? (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-1/2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      )}
    </span>
  )
}
