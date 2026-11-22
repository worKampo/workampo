import { homeRoute } from './home/home-routes'
import { codeRoute, loginRoute } from './sign-in/sign-in-routes'

export const accessRoutes = [loginRoute, codeRoute, homeRoute] as const
