import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FiAlertTriangle, FiArrowLeft, FiArrowRight, FiCheckCircle, FiChevronLeft,
  FiChevronRight, FiSearch, FiUser, FiUsers, FiXCircle,
} from 'react-icons/fi'
import { useFetch as fetchJson } from '../../utils/useFetch'
import { getSellerRoleLabel } from '../../config/sellerRoles'
import { getMemberReportingView } from '../../utils/memberReportingTree'

const PAGE_SIZE = 10
const MANAGER_ROLES = new Set(['division_manager', 'sales_director', 'unit_manager'])
const displayName = member => String(member?.full_name || member?.display_name || member?.account_code || 'Unknown member').trim()
const numberId = value => Number(value || 0)
const statusLabel = member => member?.user_status === 'active' && member?.accredited_seller_status === 'active' ? 'Active' : 'Inactive'
const dateLabel = value => {
  if (!value) return 'Not recorded'
  const parts = String(value).slice(0, 10).split('-').map(Number)
  if (parts.length !== 3 || parts.some(part => !part)) return 'Not recorded'
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  return Number.isNaN(date.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}


const Info = ({ label, value }) => (
  <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || 'Not provided'}</p>
  </div>
)

const InHouseMemberProfile = () => {
  const { groupId, memberId } = useParams()
  const location = useLocation()
  const role = location.pathname.split('/')[2] || 'super_admin'
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [teamScope, setTeamScope] = useState('all')
  const [page, setPage] = useState(1)
  const networkPath = `/portal/${role}/accredited/groups/in-house/${groupId}${location.search || ''}`
  const memberPath = userId => `/portal/${role}/accredited/groups/in-house/${groupId}/members/${userId}${location.search || ''}`
  const groupQuery = useQuery({
    queryKey: ['in-house-member-profile', Number(groupId)],
    queryFn: () => fetchJson(`/seller-groups/${groupId}`),
    enabled: Number.isSafeInteger(Number(groupId)) && Number(groupId) > 0,
    retry: 1,
    staleTime: 15000,
  })
  const group = groupQuery.data?.data?.group || null
  const members = groupQuery.data?.data?.members || []
  const detail = useMemo(() => getMemberReportingView(members, memberId), [members, memberId])
  const { selected, parent, chain, direct, descendants, incomplete } = detail
  const isManager = Boolean(selected && MANAGER_ROLES.has(selected.role))
  const networkHead = numberId(group?.seller_group_head_user_id) === numberId(memberId)
  const isInHouse = group?.seller_group_type === 'in_house'

  useEffect(() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); setTeamScope('all'); setPage(1) }, [memberId])
  const filtered = useMemo(() => {
    const candidateRows = teamScope === 'direct' ? descendants.filter(row => row.isDirect) : descendants
    const needle = search.trim().toLowerCase()
    return candidateRows.filter(row => {
      if (roleFilter !== 'all' && row.role !== roleFilter) return false
      if (statusFilter !== 'all' && statusLabel(row).toLowerCase() !== statusFilter) return false
      return !needle || `${displayName(row)} ${row.account_code || ''} ${getSellerRoleLabel(row.role)} ${row.email || ''}`.toLowerCase().includes(needle)
    })
  }, [descendants, teamScope, search, roleFilter, statusFilter])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => setPage(current => Math.min(current, pages)), [pages])
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const back = <NavLink to={networkPath} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><FiArrowLeft /> Back to Network</NavLink>
  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 pb-12 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">{back}<span className="text-xs font-medium text-slate-500">Accredited Sellers / In-House Members / Member Details</span></div>
    {groupQuery.isPending ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading member details and reporting team…</div> : null}
    {groupQuery.isError ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><strong>Couldn't load member details.</strong><p className="mt-1">{groupQuery.error?.message || 'The Network information is unavailable.'}</p><button type="button" onClick={() => groupQuery.refetch()} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold">Try Again</button></div> : null}
    {!groupQuery.isPending && !groupQuery.isError && (!isInHouse || !selected) ? <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950"><h1 className="text-lg font-bold">Member not found in this In-House Network</h1><p className="mt-2">This account may have moved to a different Network, or the member record is no longer available. No changes have been made.</p><div className="mt-4">{back}</div></div> : null}
    {!groupQuery.isPending && !groupQuery.isError && isInHouse && selected ? <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-blue-700"><FiUser size={22} /></span>
            <div><h1 className="text-xl font-bold text-slate-950 sm:text-2xl">{displayName(selected)}</h1><p className="mt-1 text-sm text-slate-600">{getSellerRoleLabel(selected.role)} · {group.seller_group_name || 'In-House Network'}</p><div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusLabel(selected) === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{statusLabel(selected)}</span>
              {networkHead ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">Network Head</span> : null}
            </div></div>
          </div>
          <button type="button" onClick={() => groupQuery.refetch()} disabled={groupQuery.isFetching} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{groupQuery.isFetching ? 'Refreshing…' : 'Refresh Details'}</button>
        </div>
        {selected.user_status !== selected.accredited_seller_status ? <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><FiAlertTriangle className="mt-0.5 shrink-0" /> Account status and seller accreditation status do not match. Check the member's account before making further changes.</p> : null}
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-bold text-slate-950">Member Information</h2><p className="mb-4 mt-1 text-sm text-slate-500">Current details saved for this accredited seller. This page is read-only.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Account Code" value={selected.account_code} />
            <Info label="Position" value={getSellerRoleLabel(selected.role)} />
            <Info label="First Name" value={selected.first_name} />
            <Info label="Middle Name" value={selected.middle_name} />
            <Info label="Last Name" value={selected.last_name} />
            <Info label="Accreditation Created" value={dateLabel(selected.accredited_seller_created_at)} />
            <Info label="Email" value={selected.email} />
            <Info label="Phone Number" value={selected.contact_no} />
            <Info label="TIN" value={selected.tin_no} />
            <Info label="PRC Number" value={selected.prc_no} />
            <Info label="Accreditation Date" value={dateLabel(selected.accredited_seller_accreditation_date)} />
            <Info label="Accredited Seller Status" value={selected.accredited_seller_status === 'active' ? 'Active' : 'Inactive'} />
            <Info label="Account Status" value={selected.user_status === 'active' ? 'Active' : 'Inactive'} />
            <Info label="Account Login" value={numberId(selected.can_login) ? 'Enabled' : 'Disabled'} />
            <div className="sm:col-span-2"><Info label="Address" value={selected.address} /></div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-950">Reporting Structure</h2>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Reports To</p>{selected.role === 'division_manager' ? <p className="mt-1 text-sm font-semibold text-slate-900">Developer</p> : parent ? <NavLink className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline" to={memberPath(parent.user_id)}>{displayName(parent)} <FiArrowRight /></NavLink> : <p className="mt-1 text-sm font-semibold text-amber-800">Not assigned / Manager unavailable</p>}</div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Reporting Chain</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">{chain.map(row => <span key={row.user_id} className="inline-flex items-center gap-1"><NavLink to={memberPath(row.user_id)} className="font-semibold text-blue-700 hover:underline">{displayName(row)}</NavLink><FiChevronRight className="text-slate-400" /></span>)}<span className="font-bold text-slate-900">{displayName(selected)}</span></div>
          {incomplete ? <p role="alert" className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><FiAlertTriangle className="shrink-0" /> An incomplete or circular reporting link was detected. This view does not change the saved assignments.</p> : null}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Info label="Direct Reports" value={String(direct.length)} />
            <Info label="Entire Team" value={String(descendants.length)} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Entire Team also counts members below other managers in this reporting branch. It does not count this member.</p>
        </section>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div><h2 className="flex items-center gap-2 text-base font-bold text-slate-950"><FiUsers /> {isManager ? 'Members Reporting to This Manager' : 'Reporting Team'}</h2><p className="mt-1 text-sm text-slate-500">View direct reports or the full downstream team. Click View to open another member's details.</p></div>
          <div className="flex flex-wrap gap-2"><span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{direct.length} Direct</span><span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{descendants.length} Total Team</span></div>
        </div>
        {(search || roleFilter !== 'all' || statusFilter !== 'all' || teamScope !== 'all') ? <div className="flex justify-end px-5 pt-3"><button type="button" onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); setTeamScope('all'); setPage(1) }} className="text-xs font-bold text-blue-700 underline-offset-2 hover:underline">Clear all filters</button></div> : null}
        <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">Find a Member</span><span className="relative block"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Name, account code or email" className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></span></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">Team Members</span><select value={teamScope} onChange={event => { setTeamScope(event.target.value); setPage(1) }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="all">Entire Team</option><option value="direct">Direct Reports Only</option></select></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">Position</span><select value={roleFilter} onChange={event => { setRoleFilter(event.target.value); setPage(1) }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="all">All Positions</option><option value="division_manager">Division Manager</option><option value="sales_director">Sales Director</option><option value="unit_manager">Unit Manager</option><option value="sales_agent">Sales Agent</option></select></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">Status</span><select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1) }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="all">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Member</th><th className="px-5 py-3">Position</th><th className="px-5 py-3">Reports To</th><th className="px-5 py-3">Relationship</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
          {pageRows.map(row => {
            const rowParent = members.find(candidate => numberId(candidate.user_id) === numberId(row.reports_under_user_id ?? row.accredited_seller_reports_under_user_id))
            return <tr key={row.user_id} className="hover:bg-slate-50"><td className="px-5 py-3"><span className="block font-bold text-slate-900">{displayName(row)}</span><span className="text-xs text-slate-500">{row.account_code || 'No account code'}</span></td><td className="px-5 py-3 text-slate-700">{getSellerRoleLabel(row.role)}</td><td className="px-5 py-3 text-slate-700">{displayName(rowParent) === 'Unknown member' ? 'Not assigned' : displayName(rowParent)}</td><td className="px-5 py-3 text-slate-700">{row.isDirect ? 'Direct Report' : `Team Member · Level ${row.reportingDepth}`}</td><td className="px-5 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${statusLabel(row) === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{statusLabel(row) === 'Active' ? <FiCheckCircle /> : <FiXCircle />}{statusLabel(row)}</span></td><td className="px-5 py-3"><NavLink to={memberPath(row.user_id)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">View <FiArrowRight /></NavLink></td></tr>
          })}
          {!pageRows.length ? <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">{!descendants.length ? (isManager ? 'No members report to this manager yet.' : 'Sales Agents do not manage other sellers.') : 'No team members match these filters. Try clearing the search or selecting All Positions and All Statuses.'}</td></tr> : null}
        </tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-4"><span className="text-xs font-medium text-slate-600">{filtered.length ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}` : '0 members'}</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage(current => Math.max(current - 1, 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40"><FiChevronLeft /> Previous</button><span className="px-2 text-xs font-bold text-slate-600">Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(current => Math.min(current + 1, pages))} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40">Next <FiChevronRight /></button></div></div>
      </section>
    </> : null}
  </div>
}

export default InHouseMemberProfile
