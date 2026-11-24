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

// From the first letter on: "3M" → "M", "🚀" → "".
const fromFirstLetter = (word: string) => {
  const index = [...word].findIndex((char) => LETTER.test(char))

  return index < 0 ? '' : [...word].slice(index).join('')
}

const upper = (text: string) => text.toLocaleUpperCase('es')

// Two letters: the first of the first and of the last word, or the first two of a single word;
// null when there is no letter to show, so the avatar shows a generic icon.
export function avatarInitials({
  name,
  email,
}: {
  name?: string | undefined
  email?: string | undefined
}) {
  if (!name?.trim()) return email?.trim() ? upper([...email.trim()][0] ?? '') : null

  const words = name
    .normalize('NFC')
    .split(/\s+/)
    .map(fromFirstLetter)
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
