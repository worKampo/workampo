import { verifyCodeSchema } from '@workampo/domain/access/sign-in/sign-in-code'

// The email comes from the previous page; the form only asks for the code.
export const verifyCodeFormSchema = verifyCodeSchema.pick({ code: true })
