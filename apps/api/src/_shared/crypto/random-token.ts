// 32 random bytes in base64url: session tokens and OAuth states.
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))

  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}
