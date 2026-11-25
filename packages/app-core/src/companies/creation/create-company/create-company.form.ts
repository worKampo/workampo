import { makeCreateCompanySchema } from '@workampo/domain/companies/creation/create-company'
import { LANGUAGES } from '@workampo/i18n'

// The form validates with the same schema as the API.
export const createCompanyFormSchema = makeCreateCompanySchema(LANGUAGES)
