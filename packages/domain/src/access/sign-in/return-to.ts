export const RETURN_TO_MAX_LENGTH = 1024

// Browsers drop tab and newline, so `/\t/x` becomes `//x`; they also read `\` as `/`.
const isUnsafeCharacter = (char: string) =>
  char <= ' ' || char === '\u007f' || char === '\\' || /\s/.test(char)
// Encoded `/`, `\`, `.` and control characters, which a later hop may decode.
const UNSAFE_ENCODING = /%(2f|5c|2e|0|1)/i

// With one leading `/` and none of the characters above, the value resolves on our own origin.
export function safeReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > RETURN_TO_MAX_LENGTH) return undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined
  if ([...value].some(isUnsafeCharacter) || UNSAFE_ENCODING.test(value)) return undefined

  const [path = ''] = value.split(/[?#]/, 1)
  // `.` and `..` segments resolve elsewhere: `/c/../login` is `/login`.
  if (path.split('/').some((segment) => segment === '.' || segment === '..')) return undefined
  // Sign-in would loop and the API answers JSON.
  if (path === '/api' || path.startsWith('/api/')) return undefined
  if (path === '/login' || path.startsWith('/login/')) return undefined

  return value
}
