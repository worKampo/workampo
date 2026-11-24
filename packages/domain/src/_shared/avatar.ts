// What an avatar shows without an image: initials and a colour slot (docs/design/components.md, Avatars).

// Words that never give an initial: "María de la Cruz" → MC.
const PARTICLES = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'y',
  'i',
  'e',
  'da',
  'das',
  'do',
  'dos',
  'di',
  'du',
  'van',
  'von',
  'der',
  'den',
  'le',
])

const LETTER = /\p{L}/u

// Only the letters of a word: "3M" → "M", "R2D2" → "RD", "🚀" → "".
const lettersOf = (word: string) => [...word].filter((char) => LETTER.test(char)).join('')

const upper = (text: string) => text.toLocaleUpperCase('es')

// The caller passes the name, or the email when there is no name yet. Two letters: the first of
// the first and of the last word, or the first two of a single word; one for an email; null when
// there is no letter to show, so the avatar shows a generic icon.
export function avatarInitials(text: string | undefined) {
  const trimmed = text?.normalize('NFC').trim() ?? ''
  const isEmail = trimmed.includes('@') && !/\s/.test(trimmed)
  if (isEmail) return upper([...lettersOf(trimmed)][0] ?? '') || null

  const words = trimmed
    .split(/\s+/)
    .map(lettersOf)
    .filter((word) => word && !PARTICLES.has(word.toLocaleLowerCase('es')))
  const [first, ...rest] = words
  if (!first) return null

  const last = rest.at(-1)
  const letters = last ? [[...first][0], [...last][0]] : [...first].slice(0, 2)

  return upper(letters.join(''))
}

// The same initials always land on the same slot of the palette, on any screen and device.
export function avatarColourSlot({ initials, slots }: { initials: string; slots: number }) {
  let hash = 0
  for (const char of initials) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 2 ** 31

  return hash % slots
}
