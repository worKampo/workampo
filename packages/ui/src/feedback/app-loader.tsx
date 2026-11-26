import { LogoMark } from '../brand/logo-mark'

// The same markup lives as static HTML in apps/web/index.html, so its styles are the app-loader classes in styles.css.
export function AppLoader({ label }: { label: string }) {
  return (
    <div className="app-loader" role="status" aria-label={label}>
      <LogoMark size={48} bead />
    </div>
  )
}
