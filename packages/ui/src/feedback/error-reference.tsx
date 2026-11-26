import { useEffect, useRef, useState } from 'react'
import { Button } from '../actions/button'
import { Text } from '../content/text'
import { Tooltip } from '../overlays/tooltip'

type Labels = {
  // The whole line, with the reference in it: «Referencia: 7F3K-92QD».
  line: string
  copy: string
  copied: string
  copiedStatus: string
  copyFailed: string
}

const COPIED_MS = 2000

// docs/design/components.md, "Error reference".
export function ErrorReference({ reference, labels }: { reference: string; labels: Labels }) {
  const code = useRef<HTMLElement>(null)
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [before, after] = splitAround(labels.line, reference)

  useEffect(() => {
    if (state !== 'copied') return
    const timer = setTimeout(() => setState('idle'), COPIED_MS)
    return () => clearTimeout(timer)
  }, [state])

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference)
      setState('copied')
    } catch {
      // No clipboard (insecure context, old browser) lands here too, as a TypeError.
      if (code.current) window.getSelection()?.selectAllChildren(code.current)
      setState('failed')
    }
  }

  const copied = state === 'copied'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <Text size="xs" tone="muted" className="min-w-0">
          {before}
          <code ref={code} dir="ltr" translate="no" className="select-all break-all">
            {reference}
          </code>
          {after}
        </Text>
        <Tooltip content={copied ? labels.copied : labels.copy}>
          <Button variant="subtle" size="icon" aria-label={labels.copy} onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </Tooltip>
      </div>
      <span role="status" className="sr-only">
        {copied ? labels.copiedStatus : ''}
      </span>
      {state === 'failed' && (
        <Text size="xs" tone="negative" role="alert">
          {labels.copyFailed}
        </Text>
      )}
    </div>
  )
}

function splitAround(line: string, reference: string): [string, string] {
  const at = line.indexOf(reference)
  if (at === -1) return [`${line} `, '']
  return [line.slice(0, at), line.slice(at + reference.length)]
}

const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function CopyIcon() {
  return (
    <svg {...ICON} aria-hidden="true" className="size-4">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg {...ICON} aria-hidden="true" className="size-4 text-pos">
      <path d="m5 12 5 5 9-10" />
    </svg>
  )
}
