// Rules of the views that a type or an import cannot express (ADR-0047, ADR-0066, code conventions).

const isTest = (path) => /\.test\.tsx?$|\/_shared\/testing\//.test(path)
const WEB_VIEW = /^apps\/web\/src\/.+\.tsx$/

// Every visible text comes from packages/i18n: JSX text that starts with a letter is written by hand.
export function handwrittenTextErrors({ path, text }) {
  if (!WEB_VIEW.test(path) || isTest(path)) return []
  // Text between a tag and its closing tag; `=>` and generics are not JSX.
  const found = text.match(/(?<![=-])>\s*(\p{L}[^<>{}=;|]*?)\s*<\//u)

  return found
    ? [`${path}: "${found[1]}" is written by hand; take it from packages/i18n with t()`]
    : []
}

// Sizes, colours and shadows come from the tokens and the Tailwind scale, never `-[…]`.
export function arbitraryValueErrors({ path, text }) {
  if (!/^(apps|packages)\/[^/]+\/src\/.+\.(tsx?|css)$/.test(path) || isTest(path)) return []
  const found = text.match(/[\w:]+-\[[^\]\s]+\]/)

  return found
    ? [
        `${path}: ${found[0]} is an arbitrary value; add a token to packages/ui/src/styles/tokens.css`,
      ]
    : []
}

// A page and its pieces carry no classes of their own: they use packages/ui (or its helpers).
export function pageClassErrors({ path, text }) {
  if (!WEB_VIEW.test(path) || isTest(path) || /\/_shared\//.test(path)) return []
  const found = text.match(/className=(["'`]|\{\s*["'`])/)

  return found ? [`${path}: a className written by hand; use a packages/ui component`] : []
}
