import { homeRoute } from './home/home.route'
import { codeRoute, loginRoute } from './sign-in/sign-in.route'

export const accessRoutes = [loginRoute, codeRoute, homeRoute] as const
