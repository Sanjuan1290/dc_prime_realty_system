import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArrowLeft,
  FiBriefcase,
  FiCheckCircle,
  FiDollarSign,
  FiEdit2,
  FiMail,
  FiMapPin,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiTrendingUp,
  FiUserPlus,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import EditGroupModal from '../../components/System/sellerGroupComponents/EditGroupModal'
import CreateUserModal from '../../components/System/userComponents/CreateUserModal'
import EditUserModal from '../../components/System/userComponents/EditUserModal'
import { getSellerRoleLabel } from '../../config/sellerRoles'
import { useFetch as fetchJson } from '../../utils/useFetch'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const toDateInput = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`

const defaultRange = () => ({
  from: toDateInput(new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)),
  to: toDateInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
})

const MEMBERS_PER_PAGE = 5

const summaryToneClasses = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
}

const SummaryCard = ({ icon: Icon, label, value, helper, tone = 'blue' }) => (
  <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
          {label}
        </p>
        <p className="mt-2 truncate text-xl font-bold tracking-tight text-slate-950">
          {value}
        </p>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{helper}</p>
      </div>

      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${summaryToneClasses[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </span>
    </div>
  </article>
)

const rateCardColorClasses = {
  blue: {
    card: 'border-blue-200 bg-blue-50/80',
    label: 'text-blue-600',
    value: 'text-blue-950',
    helper: 'text-blue-700',
    icon: 'text-blue-700 ring-blue-100',
  },
  purple: {
    card: 'border-purple-200 bg-purple-50/80',
    label: 'text-purple-600',
    value: 'text-purple-950',
    helper: 'text-purple-700',
    icon: 'text-purple-700 ring-purple-100',
  },
  yellow: {
    card: 'border-yellow-200 bg-yellow-50/80',
    label: 'text-yellow-700',
    value: 'text-yellow-950',
    helper: 'text-yellow-700',
    icon: 'text-yellow-700 ring-yellow-100',
  },
  gray: {
    card: 'border-gray-200 bg-gray-50/80',
    label: 'text-gray-600',
    value: 'text-gray-950',
    helper: 'text-gray-700',
    icon: 'text-gray-700 ring-gray-200',
  },
  green: {
    card: 'border-green-200 bg-green-50/80',
    label: 'text-green-600',
    value: 'text-green-950',
    helper: 'text-green-700',
    icon: 'text-green-700 ring-green-100',
  },
}

const RateCard = ({ label, value, helper, bgColor = 'blue' }) => {
  const colors = rateCardColorClasses[bgColor] || rateCardColorClasses.blue

  return (
    <article className={`rounded-2xl border p-5 ${colors.card}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-[11px] font-bold uppercase tracking-[0.08em] ${colors.label}`}
          >
            {label}
          </p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${colors.value}`}>
            {Number(value || 0).toFixed(2)}%
          </p>
          <p className={`mt-1 text-xs font-medium ${colors.helper}`}>{helper}</p>
        </div>

        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ${colors.icon}`}
        >
          <FiTrendingUp className="h-4 w-4" />
        </span>
      </div>
    </article>
  )
}

const ContactItem = ({ icon: Icon, label, value, wide = false }) => (
  <div className={`flex min-w-0 items-start gap-3 ${wide ? 'md:col-span-2 xl:col-span-1' : ''}`}>
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
      <Icon className="h-4 w-4" />
    </span>

    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-800">
        {value || '-'}
      </p>
    </div>
  </div>
)

const DetailItem = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
      {label}
    </p>
    <div className="mt-1 text-sm font-semibold text-slate-900">{children}</div>
  </div>
)

const SectionHeading = ({ title, description, actions }) => (
  <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h2 className="text-base font-bold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
    </div>
    {actions}
  </div>
)

const SellerGroupDetails = ({ expectedGroupType }) => {
  const { groupId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const isAdmin = location.pathname.startsWith('/portal/admin/')
  const rootPath = isAdmin ? '/portal/admin' : '/portal/super_admin'
  const [alert, setAlert] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberPage, setMemberPage] = useState(1)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [range, setRange] = useState(defaultRange)
  const selectedProjectId = Number(searchParams.get('project') || 0)

  const projectOptionsQuery = useQuery({
    queryKey: ['seller-group-project-options', Number(groupId)],
    queryFn: () => fetchJson(`/seller-groups/${groupId}/projects`),
    enabled: Boolean(groupId),
  })

  const accreditedProjects = useMemo(
    () => projectOptionsQuery.data?.data || [],
    [projectOptionsQuery.data]
  )
  const groupOption = projectOptionsQuery.data?.group || {}
  const groupType = groupOption.type || expectedGroupType || 'in_house'
  const isExternal = groupType === 'external'
  const groupsPath = `${rootPath}/users/groups/${isExternal ? 'external' : 'in-house'}`

  useEffect(() => {
    if (!accreditedProjects.length) return

    if (
      !accreditedProjects.some(
        (project) => Number(project.lot_project_id) === selectedProjectId
      )
    ) {
      setSearchParams(
        { project: String(accreditedProjects[0].lot_project_id) },
        { replace: true }
      )
    }
  }, [accreditedProjects, selectedProjectId, setSearchParams])

  const configurationQuery = useQuery({
    queryKey: [
      'seller-group-project-configuration',
      Number(groupId),
      selectedProjectId,
    ],
    queryFn: () =>
      fetchJson(`/seller-groups/${groupId}/projects/${selectedProjectId}`),
    enabled: Boolean(groupId && selectedProjectId),
    placeholderData: (previous) => previous,
  })

  const analyticsQuery = useQuery({
    queryKey: [
      'seller-group-project-analytics',
      Number(groupId),
      selectedProjectId,
      range.from,
      range.to,
    ],
    queryFn: () =>
      fetchJson(
        `/seller-groups/${groupId}/projects/${selectedProjectId}/analytics?${new URLSearchParams(
          range
        )}`
      ),
    enabled: Boolean(groupId && selectedProjectId && range.from && range.to),
    placeholderData: (previous) => previous,
  })

  const configuration = configurationQuery.data?.data || null
  const group = configuration?.group || {
    id: Number(groupId),
    name: groupOption.name || 'Group',
    type: groupType,
    status: groupOption.status,
    projectRates: accreditedProjects,
  }
  const project =
    configuration?.project ||
    accreditedProjects.find(
      (item) => Number(item.lot_project_id) === selectedProjectId
    ) ||
    {}
  const fixedRates = configuration?.fixedRates || {}
  const members = useMemo(
    () =>
      (configuration?.members || []).filter((member) => !member.is_system_dummy),
    [configuration]
  )
  const analytics = analyticsQuery.data?.data?.summary || {}
  const filteredMembers = useMemo(() => {
    const key = memberSearch.trim().toLowerCase()

    return key
      ? members.filter((member) =>
          `${member.display_name} ${member.full_name} ${member.role} ${member.reports_under_name}`
            .toLowerCase()
            .includes(key)
        )
      : members
  }, [members, memberSearch])

  const memberTotalPages = Math.max(
    Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE),
    1
  )
  const memberPageStart = (memberPage - 1) * MEMBERS_PER_PAGE
  const memberPageEnd = Math.min(
    memberPageStart + MEMBERS_PER_PAGE,
    filteredMembers.length
  )
  const paginatedMembers = filteredMembers.slice(memberPageStart, memberPageEnd)

  useEffect(() => {
    setMemberPage((currentPage) => Math.min(currentPage, memberTotalPages))
  }, [memberTotalPages])

  useEffect(() => {
    setMemberPage(1)
  }, [selectedProjectId, groupId])

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['seller-group-project-options', Number(groupId)],
    })
    queryClient.invalidateQueries({
      queryKey: ['seller-group-project-configuration', Number(groupId)],
    })
    queryClient.invalidateQueries({
      queryKey: ['seller-group-project-analytics', Number(groupId)],
    })
    queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
    queryClient.invalidateQueries({ queryKey: ['reservation-agents'] })
    queryClient.invalidateQueries({ queryKey: ['commission-preview'] })
  }

  const selectedGroupForEdit = {
    seller_group_id: group.id || Number(groupId),
    seller_group_type: group.type || groupType,
    seller_group_name: group.name || groupOption.name,
    seller_group_head_user_id: group.headUserId,
    seller_group_head_role: group.headRole,
    seller_group_description: group.description,
    seller_group_status: group.status || groupOption.status,
    seller_group_external_account_user_id: group.externalAccountUserId,
    external_account_user_id: group.externalAccountUserId,
    external_account_first_name: group.externalAccount?.firstName,
    external_account_middle_name: group.externalAccount?.middleName,
    external_account_last_name: group.externalAccount?.lastName,
    external_account_email: group.externalAccount?.email,
    external_account_contact_no: group.externalAccount?.contactNo,
    external_account_tin_no: group.externalAccount?.tinNo,
    external_account_prc_no: group.externalAccount?.prcNo,
    external_account_address: group.externalAccount?.address,
    project_rates: group.projectRates || accreditedProjects,
  }

  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <PageHeader
            title={
              group.name ||
              groupOption.name ||
              (isExternal ? 'External Group' : 'In-House Group')
            }
            description={
              isExternal
                ? 'External partner account, project pool rate, sales, commissions, and releases.'
                : 'Internal hierarchy, fixed position rates, sales, commissions, and releases.'
            }
            icon={FiUsers}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <NavLink
            to={groupsPath}
            aria-label="Back to seller groups"
            className="flex h-11 w-fit px-4 text-sm items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
          >
            <FiArrowLeft /> Back
          </NavLink>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <FiRefreshCw />
            Refresh
          </button>

          {!isExternal ? (
            <button
              type="button"
              onClick={() => setShowCreateUser(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <FiUserPlus />
              Add Member
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowEditGroupModal(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <FiEdit2 />
            Edit Group
          </button>
        </div>
      </div>

      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      ) : null}

      {projectOptionsQuery.isLoading || configurationQuery.isLoading ? (
        <StatusAlert type="loading" message="Loading group details..." />
      ) : null}

      {projectOptionsQuery.isError || configurationQuery.isError ? (
        <StatusAlert
          type="error"
          message={
            projectOptionsQuery.error?.message ||
            configurationQuery.error?.message ||
            'Failed to load group details.'
          }
        />
      ) : null}

      {expectedGroupType &&
      groupOption.type &&
      expectedGroupType !== groupOption.type ? (
        <StatusAlert
          type="error"
          message="This group was opened from the wrong group section."
        />
      ) : null}

      {configuration ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Group Type">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                  <FiBriefcase className="h-3.5 w-3.5" />
                  {isExternal ? 'External Group' : 'In-House Group'}
                </span>
              </DetailItem>

              <DetailItem label="Status">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold capitalize text-emerald-700 ring-1 ring-emerald-100">
                  <FiCheckCircle className="h-3.5 w-3.5" />
                  {group.status || 'active'}
                </span>
              </DetailItem>

              <DetailItem label={isExternal ? 'Representative' : 'Group Head'}>
                {isExternal
                  ? group.externalAccount?.fullName || '-'
                  : group.headName || 'No head assigned'}
              </DetailItem>

              <DetailItem label="Accredited Projects">
                {accreditedProjects.length}
              </DetailItem>
            </div>

            {isExternal ? (
              <div className="grid gap-5 border-t border-slate-100 bg-slate-50/60 p-5 md:grid-cols-2 xl:grid-cols-[0.8fr_0.7fr_1.8fr]">
                <ContactItem
                  icon={FiMail}
                  label="Email"
                  value={group.externalAccount?.email}
                />
                <ContactItem
                  icon={FiPhone}
                  label="Contact Number"
                  value={group.externalAccount?.contactNo}
                />
                <ContactItem
                  icon={FiMapPin}
                  label="Address"
                  value={group.externalAccount?.address}
                  wide
                />
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <SectionHeading
              title="Project Commission Structure"
              description={
                isExternal
                  ? 'The Pool Rate is the full commission assigned to this group.'
                  : 'The fixed position rates must equal the project Pool Rate.'
              }
              actions={
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    Project
                  </span>
                  <select
                    value={selectedProjectId || ''}
                    onChange={(event) =>
                      setSearchParams(
                        { project: event.target.value },
                        { replace: true }
                      )
                    }
                    className="h-10 min-w-[240px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="" disabled>
                      Select project
                    </option>
                    {accreditedProjects.map((item) => (
                      <option key={item.lot_project_id} value={item.lot_project_id}>
                        {item.lot_project_name}
                      </option>
                    ))}
                  </select>
                </label>
              }
            />

            <div
              className={`grid gap-4 p-5 ${
                isExternal ? 'max-w-2xl' : 'sm:grid-cols-2 xl:grid-cols-5'
              }`}
            >
              <RateCard
                label="Pool Rate"
                value={fixedRates.poolRate}
                helper={project.lot_project_name || 'Selected project'}
                bgColor="blue"
              />

              {!isExternal ? (
                <>
                  <RateCard
                    label="Division Manager Rate"
                    value={fixedRates.divisionManagerRate}
                    helper="Top in-house position"
                    bgColor="purple"
                  />
                  <RateCard
                    label="Sales Director Rate"
                    value={fixedRates.salesDirectorRate}
                    helper="Fixed override"
                    bgColor="yellow"
                  />
                  <RateCard
                    label="Unit Manager Rate"
                    value={fixedRates.unitManagerRate}
                    helper="Fixed override"
                    bgColor="gray"
                  />
                  <RateCard
                    label="Sales Agent Rate"
                    value={fixedRates.salesAgentRate}
                    helper="Direct sales rate"
                    bgColor="green"
                  />
                </>
              ) : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <SectionHeading
              title="Performance"
              description="Released commissions are grouped by actual release date."
              actions={
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      From
                    </span>
                    <input
                      type="date"
                      value={range.from}
                      onChange={(event) =>
                        setRange((current) => ({
                          ...current,
                          from: event.target.value,
                        }))
                      }
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      To
                    </span>
                    <input
                      type="date"
                      value={range.to}
                      onChange={(event) =>
                        setRange((current) => ({
                          ...current,
                          to: event.target.value,
                        }))
                      }
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    />
                  </label>
                </div>
              }
            />

            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <SummaryCard
                icon={FiUsers}
                label={isExternal ? 'Group Accounts' : 'Active Members'}
                value={
                  isExternal ? 1 : configuration.summary?.activeMembers || 0
                }
                helper={isExternal ? 'One account' : 'Active in-house sellers'}
                tone="blue"
              />
              <SummaryCard
                icon={FiShoppingBag}
                label="Sales"
                value={analytics.salesCount || 0}
                helper="Reserved accounts"
                tone="violet"
              />
              <SummaryCard
                icon={FiDollarSign}
                label="Sales Value"
                value={money(analytics.salesAmount)}
                helper="Total contract price"
                tone="cyan"
              />
              <SummaryCard
                icon={FiTrendingUp}
                label="Gross Commission"
                value={money(analytics.grossCommission)}
                helper="Accumulated commission"
                tone="amber"
              />
              <SummaryCard
                icon={FiDollarSign}
                label="Released"
                value={money(analytics.releasedCommission)}
                helper="Commission already paid"
                tone="emerald"
              />
              <SummaryCard
                icon={FiDollarSign}
                label="Remaining"
                value={money(analytics.remainingCommission)}
                helper="Commission not yet released"
                tone="slate"
              />
            </div>

            {analyticsQuery.isLoading ? (
              <div className="px-5 pb-5">
                <StatusAlert type="loading" message="Loading performance..." />
              </div>
            ) : null}
          </section>

          {isExternal ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <SectionHeading
                title="External Group Account"
                description="This single account receives all commissions for the group."
              />

              <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
                <DetailItem label="Name">
                  {group.externalAccount?.fullName || '-'}
                </DetailItem>
                <DetailItem label="Email">
                  {group.externalAccount?.email || '-'}
                </DetailItem>
                <DetailItem label="TIN">
                  {group.externalAccount?.tinNo || '-'}
                </DetailItem>
                <DetailItem label="Login">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                      group.externalAccount?.canLogin
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        : 'bg-slate-100 text-slate-600 ring-slate-200'
                    }`}
                  >
                    {group.externalAccount?.canLogin ? 'Enabled' : 'Disabled'}
                  </span>
                </DetailItem>
              </div>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <SectionHeading
                title="In-House Members"
                description="Each member inherits the fixed project rate for their position."
                actions={
                  <label className="relative block w-full lg:w-80">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={memberSearch}
                      onChange={(event) => {
                        setMemberSearch(event.target.value)
                        setMemberPage(1)
                      }}
                      placeholder="Search member, role, or parent..."
                      className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    />
                  </label>
                }
              />

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {['Seller', 'Position', 'Reports Under', 'Status', 'Actions'].map(
                        (head) => (
                          <th
                            key={head}
                            className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
                          >
                            {head}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedMembers.map((member) => (
                      <tr
                        key={member.accredited_seller_id}
                        className="transition hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-4 font-semibold text-slate-950">
                          {member.display_name}
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-700">
                          {getSellerRoleLabel(member.role)}
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-700">
                          {member.reports_under_name ||
                            (Number(member.user_id) === Number(group.headUserId)
                              ? 'Developer'
                              : 'Not assigned')}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold capitalize text-emerald-700 ring-1 ring-emerald-100">
                            {member.accredited_seller_status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedMember({
                              ...member,
                              id: Number(member.user_id),
                              status:
                                member.user_status ||
                                member.accredited_seller_status,
                              seller_group_id: Number(group.id || groupId),
                              reports_under_user_id:
                                member.accredited_seller_reports_under_user_id || '',
                            })}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            <FiEdit2 />
                            Edit User
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!filteredMembers.length ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-10 text-center font-medium text-slate-500"
                        >
                          No members found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {filteredMembers.length ? (
                <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-slate-500">
                    Showing {memberPageStart + 1}-{memberPageEnd} of{' '}
                    {filteredMembers.length} members
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMemberPage((currentPage) => Math.max(currentPage - 1, 1))
                      }
                      disabled={memberPage === 1}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>

                    <span className="min-w-[96px] text-center text-xs font-bold text-slate-600">
                      Page {memberPage} of {memberTotalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setMemberPage((currentPage) =>
                          Math.min(currentPage + 1, memberTotalPages)
                        )
                      }
                      disabled={memberPage === memberTotalPages}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          )}
        </>
      ) : null}

      {showCreateUser ? (
        <CreateUserModal
          setShowCreateUser={setShowCreateUser}
          allowedRoles={[
            'division_manager',
            'sales_director',
            'unit_manager',
            'sales_agent',
          ]}
          actorRole={isAdmin ? 'admin' : 'super_admin'}
          initialSellerGroupId={String(group.id || groupId)}
          lockSellerGroup
          title={`Add User to ${group.name}`}
          onSaved={(message) => {
            setAlert({ type: 'success', message })
            refresh()
          }}
        />
      ) : null}

      {selectedMember ? (
        <EditUserModal
          key={selectedMember.id}
          setShowEditUser={(open) => {
            if (!open) setSelectedMember(null)
          }}
          selectedUser={selectedMember}
          allowedRoles={[
            'division_manager',
            'sales_director',
            'unit_manager',
            'sales_agent',
          ]}
          actorRole={isAdmin ? 'admin' : 'super_admin'}
          initialSellerGroupId={String(group.id || groupId)}
          lockSellerGroup
          onSaved={(message) => {
            setSelectedMember(null)
            setAlert({ type: 'success', message })
            refresh()
          }}
        />
      ) : null}

      {showEditGroupModal ? (
        <EditGroupModal
          setShowEditGroupModal={setShowEditGroupModal}
          selectedGroup={selectedGroupForEdit}
          groupType={groupType}
          onSaved={(message) => {
            setAlert({ type: 'success', message })
            refresh()
          }}
        />
      ) : null}
    </main>
  )
}

export default SellerGroupDetails