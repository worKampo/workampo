import { z } from 'zod'
import { emailSchema } from './email'

export const signInCodeSchema = z.string().regex(/^[0-9]{6}$/)

export const startCodeSignInSchema = z.object({ email: emailSchema })

export const verifyCodeSchema = z.object({ email: emailSchema, code: signInCodeSchema })
