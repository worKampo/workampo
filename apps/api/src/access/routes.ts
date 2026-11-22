import { Hono } from 'hono'
import type { AppEnv } from '../_shared/http/app-env'
import { sessionRoutes } from './session/routes'
import { signInRoutes } from './sign-in/routes'

export const accessRoutes = new Hono<AppEnv>().route('/', signInRoutes).route('/', sessionRoutes)
