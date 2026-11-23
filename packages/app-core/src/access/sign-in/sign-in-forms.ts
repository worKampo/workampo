import {
  startCodeSignInSchema,
  verifyCodeSchema,
} from '@workampo/domain/access/sign-in/sign-in-code'

// The forms validate with the same schemas as the API: the email screen, then the code screen.
export const loginFormSchema = startCodeSignInSchema

export const codeFormSchema = verifyCodeSchema.pick({ code: true })
