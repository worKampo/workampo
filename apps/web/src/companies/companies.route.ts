import { newCompanyRoute } from './creation/creation.route'
import { workspaceRoute } from './workspace/workspace.route'

export const companiesRoutes = [newCompanyRoute, workspaceRoute] as const
