import { createContext, type ReactNode, useContext, useEffect } from 'react'

const APP_NAME = 'worKampo'

const CompanyContext = createContext<string | undefined>(undefined)

export function DocumentTitleProvider({
  company,
  children,
}: {
  company: string
  children: ReactNode
}) {
  return <CompanyContext.Provider value={company}>{children}</CompanyContext.Provider>
}

export function useDocumentTitle(page: string) {
  const company = useContext(CompanyContext)

  useEffect(() => {
    document.title = [page, company, APP_NAME].filter(Boolean).join(' · ')
  }, [page, company])
}
