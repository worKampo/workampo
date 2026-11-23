import { Hono } from 'hono'
import type { AppEnv } from '../../_shared/http/app-env'
import { meRoute } from './me/me-route'
import { signOutRoute } from './sign-out/sign-out-route'

export const sessionRoutes = new Hono<AppEnv>().route('/', meRoute).route('/', signOutRoute)
