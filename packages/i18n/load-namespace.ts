// One file per language and namespace, fetched when a screen needs it (ADR-0073 point 4).
// Bundlers turn the template into one chunk per file; the API never imports this module.
export async function loadNamespace({
  language,
  namespace,
}: {
  language: string
  namespace: string
}): Promise<Record<string, unknown>> {
  const texts = await import(`./locales/${language}/${namespace}.json`)

  return texts.default
}
