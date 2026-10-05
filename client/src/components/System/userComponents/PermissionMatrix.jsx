import { useEffect, useRef, useState } from 'react'
import { FiAlertTriangle, FiChevronDown, FiChevronRight, FiRotateCcw, FiSearch } from 'react-icons/fi'
import {
  cleanPermissionLabel,
  getPermissionType,
  isSensitivePermission,
  needsHeadApproval,
} from '../../../utils/permissionMeta'

const tone = {
  required: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  inherited: 'border-blue-200 bg-blue-50 text-blue-900',
  restricted: 'border-slate-200 bg-slate-100 text-slate-400',
  optional: 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50',
  outside: 'border-amber-300 bg-amber-50 text-slate-800 hover:border-amber-400 hover:bg-amber-100',
}

const typeTone = {
  View: 'bg-slate-100 text-slate-600',
  Edit: 'bg-amber-50 text-amber-800',
  Delete: 'bg-red-50 text-red-700',
  'Export / Print': 'bg-sky-50 text-sky-700',
}

// Section checkbox with a real partly-selected state.
const GroupCheckbox = ({ checked, indeterminate, disabled, onChange, label }) => {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = Boolean(indeterminate) }, [indeterminate])
  return <input ref={ref} type="checkbox" aria-label={`Select every assignable permission in ${label}`} checked={checked} disabled={disabled} onChange={onChange} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
}

/**
 * Permission grid used by Create User, User Access and Role & Access Control.
 *
 * Role defaults are recommendations, not hard department ceilings. Normal
 * business permissions remain assignable across departments and are flagged as
 * "Outside normal role" when they are unusual for the selected position.
 * Genuine governance/security permissions can still be restricted by the
 * server policy and are shown as "Restricted governance".
 */
const PermissionMatrix = ({
  catalog = [],
  selected = [],
  onChange,
  disabled = false,
  policy = null,
  baseline = null,
  baselineLabel = 'role default',
  priorityGroups = [],
}) => {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [collapsed, setCollapsed] = useState({})
  const [confirmViewAll, setConfirmViewAll] = useState(false)

  const selectedSet = new Set(selected || [])
  const required = new Set(policy?.required || [])
  const inherited = new Set(policy?.inherited || [])
  const ceiling = policy?.ceiling ? new Set(policy.ceiling) : null
  const recommended = new Set(policy?.recommended || baseline || [])
  const baselineSet = baseline ? new Set(baseline) : null
  const allKeys = catalog.flatMap((group) => (group.items || []).map(([, key]) => key))

  const stateFor = (key) => {
    if (required.has(key)) return 'required'
    if (inherited.has(key)) return 'inherited'
    if (ceiling && !ceiling.has(key)) return 'restricted'
    return 'optional'
  }
  const isOutsideNormal = (key) => stateFor(key) === 'optional' && recommended.size > 0 && !recommended.has(key)
  const isLocked = (key) => disabled || stateFor(key) !== 'optional'
  const effectiveChecked = (key) => required.has(key) || inherited.has(key) || selectedSet.has(key)
  const optionalKeys = allKeys.filter((key) => stateFor(key) === 'optional')
  const optionalViewKeys = optionalKeys.filter((key) => getPermissionType(key) === 'View')
  const commit = (next) => onChange?.([...next])

  const added = baselineSet ? optionalKeys.filter((key) => selectedSet.has(key) && !baselineSet.has(key)) : []
  const removed = baselineSet ? optionalKeys.filter((key) => !selectedSet.has(key) && baselineSet.has(key)) : []
  const changedSet = new Set([...added, ...removed])
  const grantedCount = allKeys.filter((key) => stateFor(key) !== 'restricted' && effectiveChecked(key)).length
  const outsideSelected = optionalKeys.filter((key) => selectedSet.has(key) && isOutsideNormal(key))

  const toggle = (key) => {
    if (isLocked(key)) return
    const next = new Set(selectedSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    commit(next)
  }

  const toggleGroup = (group) => {
    if (disabled) return
    const keys = (group.items || []).map(([, key]) => key).filter((key) => stateFor(key) === 'optional')
    const allSelected = keys.length > 0 && keys.every((key) => selectedSet.has(key))
    const next = new Set(selectedSet)
    keys.forEach((key) => allSelected ? next.delete(key) : next.add(key))
    commit(next)
  }

  // View-only "select all" still requires a second click because it may include
  // cross-department View permissions.
  const grantAllView = () => {
    if (!confirmViewAll) { setConfirmViewAll(true); return }
    commit(new Set([...selectedSet, ...optionalViewKeys]))
    setConfirmViewAll(false)
  }
  useEffect(() => {
    if (!confirmViewAll) return undefined
    const timer = setTimeout(() => setConfirmViewAll(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmViewAll])

  const needle = search.trim().toLowerCase()
  const visibleItems = (group) => (group.items || []).filter(([label, key]) => {
    if (needle && !`${cleanPermissionLabel(label)} ${group.group} ${key}`.toLowerCase().includes(needle)) return false
    if (filter === 'granted' && !effectiveChecked(key)) return false
    if (filter === 'changed' && !changedSet.has(key)) return false
    if (filter === 'outside' && !isOutsideNormal(key)) return false
    return true
  })

  const priority = new Map(priorityGroups.map((name, index) => [name, index]))
  const usable = (group) => (group.items || []).some(([, key]) => stateFor(key) !== 'restricted')
  const orderedGroups = [...catalog].sort((a, b) => {
    const usableDelta = Number(usable(b)) - Number(usable(a))
    if (usableDelta) return usableDelta
    return (priority.get(a.group) ?? 999) - (priority.get(b.group) ?? 999)
  })

  const isGroupCollapsed = (group) => {
    if (needle || filter !== 'all') return false
    if (collapsed[group.group] !== undefined) return collapsed[group.group]
    return (group.items || []).every(([, key]) => stateFor(key) === 'restricted')
  }
  const setAllCollapsed = (value) => setCollapsed(Object.fromEntries(catalog.map((group) => [group.group, value])))

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wide">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">Required</span>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">From Staff Role</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Outside normal role</span>
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-500">Restricted governance</span>
          </div>
          <p className="text-sm font-black text-slate-700">{grantedCount} permission{grantedCount === 1 ? '' : 's'} granted</p>
        </div>

        {outsideSelected.length ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            <FiAlertTriangle className="mt-0.5 shrink-0" />
            <span><span className="font-black">{outsideSelected.length} outside-normal permission{outsideSelected.length === 1 ? '' : 's'} selected.</span> This is allowed for cross-department responsibilities, but review these carefully to avoid accidental access.</span>
          </div>
        ) : null}

        {baselineSet ? (
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${changedSet.size ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600'}`}>
            <span>{changedSet.size ? `Customized: ${added.length} added, ${removed.length} removed vs ${baselineLabel}` : `Matches the ${baselineLabel}`}</span>
            {changedSet.size && !disabled ? <button type="button" onClick={() => commit(new Set(baseline))} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-800"><FiRotateCcw /> Reset to {baselineLabel}</button> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search permissions" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-400" />
          </label>
          <div className="flex rounded-xl border border-slate-300 bg-white p-1 text-xs font-black" role="group" aria-label="Filter permissions">
            {[
              ['all', 'All'],
              ['granted', 'Granted'],
              ['outside', 'Outside normal role'],
              ...(baselineSet ? [['changed', 'Changed from default']] : []),
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 ${filter === value ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={() => setAllCollapsed(false)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700">Expand all</button>
          <button type="button" onClick={() => setAllCollapsed(true)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700">Collapse all</button>
          {!disabled ? <>
            <button type="button" onClick={grantAllView} disabled={!optionalViewKeys.length} className={`rounded-xl border px-3 py-2 text-xs font-black ${confirmViewAll ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700'} disabled:opacity-50`}>{confirmViewAll ? `Confirm: grant ${optionalViewKeys.length} view permissions` : 'Select all View'}</button>
            <button type="button" onClick={() => commit(new Set())} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700">Clear All</button>
          </> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {orderedGroups.map((group) => {
          const items = visibleItems(group)
          if ((needle || filter !== 'all') && !items.length) return null
          const groupKeys = (group.items || []).map(([, key]) => key)
          const optional = groupKeys.filter((key) => stateFor(key) === 'optional')
          const assignableKeys = groupKeys.filter((key) => stateFor(key) !== 'restricted')
          const grantedInGroup = assignableKeys.filter((key) => effectiveChecked(key)).length
          const allSelected = optional.length > 0 && optional.every((key) => selectedSet.has(key))
          const someSelected = optional.some((key) => selectedSet.has(key))
          const isCollapsed = isGroupCollapsed(group)
          return <section key={group.group} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <GroupCheckbox label={group.group} checked={allSelected} indeterminate={!allSelected && someSelected} disabled={disabled || !optional.length} onChange={() => toggleGroup(group)} />
              <button type="button" onClick={() => setCollapsed((current) => ({ ...current, [group.group]: !isCollapsed }))} className="flex flex-1 items-center justify-between gap-2 text-left" aria-expanded={!isCollapsed}>
                <span className={`font-black ${assignableKeys.length ? 'text-slate-900' : 'text-slate-400'}`}>{group.group}</span>
                <span className="flex items-center gap-2 text-xs font-black text-slate-500">{assignableKeys.length ? `${grantedInGroup} of ${assignableKeys.length}` : 'Restricted governance only'}{isCollapsed ? <FiChevronRight /> : <FiChevronDown />}</span>
              </button>
            </div>
            {!isCollapsed ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {items.map(([label, key]) => {
                const state = stateFor(key)
                const type = getPermissionType(key)
                const changed = changedSet.has(key)
                const outsideNormal = isOutsideNormal(key)
                const cardTone = outsideNormal ? tone.outside : tone[state]
                return <label key={key} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${cardTone} ${changed ? 'ring-2 ring-amber-300' : ''} ${isLocked(key) ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={effectiveChecked(key)} disabled={isLocked(key)} onChange={() => toggle(key)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600" />
                  <span className="min-w-0">
                    <span className="font-semibold">{cleanPermissionLabel(label)}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1 text-[10px] font-black">
                      <span className={`rounded px-1.5 py-0.5 ${typeTone[type]}`}>{type}</span>
                      {isSensitivePermission(key) ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">Sensitive</span> : null}
                      {needsHeadApproval(key) ? <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-700">Needs Head approval</span> : null}
                      {outsideNormal ? <span className="rounded bg-amber-200 px-1.5 py-0.5 text-amber-900">Outside normal role</span> : null}
                      {state === 'required' ? <span className="rounded bg-white/70 px-1.5 py-0.5 uppercase tracking-wide opacity-80">Required</span> : null}
                      {state === 'inherited' ? <span className="rounded bg-white/70 px-1.5 py-0.5 uppercase tracking-wide opacity-80">From Staff Role</span> : null}
                      {state === 'restricted' ? <span className="rounded bg-white/70 px-1.5 py-0.5 uppercase tracking-wide opacity-80">Restricted governance</span> : null}
                      {changed ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">{selectedSet.has(key) ? 'Added' : 'Removed'}</span> : null}
                    </span>
                  </span>
                </label>
              })}
            </div> : null}
          </section>
        })}
      </div>
    </div>
  )
}

export default PermissionMatrix
