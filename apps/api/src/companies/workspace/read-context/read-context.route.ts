import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import type { SessionVariables } from '../../../access/require-session.middleware'
import type { CompanyVariables } from '../../require-member.middleware'
import { readContext } from './read-context.logic'

export const readContextRoute = new Hono<
  AppEnv & { Variables: AppEnv['Variables'] & SessionVariables & CompanyVariables }
>().get('/', async (c) => c.json(await readContext(c.env, c.var.company)))
