import { homeRoute } from './home/routes'
import { codeRoute, loginRoute } from './sign-in/routes'

export const accessRoutes = [loginRoute, codeRoute, homeRoute] as const
