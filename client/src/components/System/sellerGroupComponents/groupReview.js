const getProjectId = (project = {}) => Number(project.lot_project_id || project.id || 0)
const getProjectName = (project = {}, fallbackId = 0) =>
  project.lot_project_name || project.name || (fallbackId ? `Project ${fallbackId}` : 'Project')

const titleCase = (value = '') => String(value || '')
  .replace(/[_-]+/g, ' ')
  .trim()
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

export const buildSellerGroupReviewPayload = ({
  form = {},
  projects = [],
  groupHeadName = '',
  groupType = 'in_house',
} = {}) => {
  const isExternal = groupType === 'external'
  const projectMap = new Map(projects.map((project) => [getProjectId(project), project]))

  const projectRates = (form.project_rates || []).map((rate) => {
    const projectId = Number(rate.lot_project_id || 0)
    const project = projectMap.get(projectId)
    const reviewRow = {
      reviewTitle: getProjectName(project, projectId),
      poolRate: Number(rate.seller_group_pool_rate || 0),
    }

    if (!isExternal) {
      reviewRow.divisionManagerRate = Number(rate.division_manager_rate || 0)
      reviewRow.salesDirectorRate = Number(rate.sales_director_rate || 0)
      reviewRow.unitManagerRate = Number(rate.unit_manager_rate || 0)
      reviewRow.salesAgentRate = Number(rate.sales_agent_rate || 0)
    }

    return reviewRow
  })

  const reviewPayload = {
    groupInformation: {
      groupName: form.seller_group_name || '',
      groupType: isExternal ? 'External Group' : 'In-House Group',
      ...(isExternal ? {} : { groupHead: groupHeadName || 'No head assigned' }),
      description: form.seller_group_description || '',
      status: titleCase(form.seller_group_status || 'active'),
    },
    projectRates,
  }

  if (isExternal) {
    const account = form.external_account || {}
    reviewPayload.externalRepresentative = {
      firstName: account.first_name || '',
      middleName: account.middle_name || '',
      lastName: account.last_name || '',
      email: account.email || '',
      contactNumber: account.contact_no || '',
      tinNo: account.tin_no || '',
      prcNo: account.prc_no || '',
      address: account.address || '',
    }
  }

  return reviewPayload
}
