// Classic synchronous script in <head>: sets the theme before first paint (CSP script-src 'self' rules out inline).
const media = window.matchMedia('(prefers-color-scheme: dark)')
const apply = () => document.documentElement.classList.toggle('dark', media.matches)

apply()
media.addEventListener('change', apply)
