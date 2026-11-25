import { newCompanyRoute } from './creation/creation.route'
import { companyPickerRoute } from './selection/selection.route'
import { workspaceRoute } from './workspace/workspace.route'

export const companiesRoutes = [companyPickerRoute, newCompanyRoute, workspaceRoute] as const
