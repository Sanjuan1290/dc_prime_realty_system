import { useEffect, useRef, useState } from 'react'
import { FiAlertTriangle, FiChevronDown, FiChevronRight, FiRotateCcw, FiSearch } from 'react-icons/fi'
import {
  ACCESS_LEVELS,
  cleanPermissionLabel,
  getAccessTier,
  getPermissionType,
  isSensitivePermission,
  needsHeadApproval,
} from '../../../utils/permissionMeta'

const tone = {
  normal: 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50',
  outside: 'border-amber-300 bg-amber-50 text-slate-800 hover:border-amber-400 hover:bg-amber-100',
}

const typeTone = {
  View: 'bg-slate-100 text-slate-600',
  Edit: 'bg-amber-50 text-amber-800',
  Delete: 'bg-red-50 text-red-700',
  'Export / Print': 'bg-sky-50 text-sky-700',
}

const levelTone = {
  none: 'bg-slate-700 text-white',
  view: 'bg-blue-600 text-white',
  edit: 'bg-indigo-600 text-white',
  full: 'bg-violet-700 text-white',
}

const sameKeys = (left, right) => left.size === right.size && [...left].every((key) => right.has(key))

// Section checkbox with a real partly-selected state.
const GroupCheckbox = ({ checked, indeterminate, disabled, onChange, label }) => {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = Boolean(indeterminate) }, [indeterminate])
  return <input ref={ref} type="checkbox" aria-label={`Select every assignable permission in ${label}`} checked={checked} disabled={disabled} onChange={onChange} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
}

/**
 * Permission grid used by Create User, User Access and Role & Access Control.
 *
 * Every role uses the same grid. Each permission is a normal checkbox that
 * starts from the role default; nothing is locked or hidden. Anything granted
 * beyond the role default shows an "Outside normal role" warning, and
 * owner-level permissions get an extra "Usually System Admin only" warning.
 *
 * Each module is one compact row with an access level (No access / View only /
 * Can edit / Full access). A level is only a shortcut that ticks the module's
 * permission keys; anything that does not match a level shows as Custom.
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
  const [expanded, setExpanded] = useState({})
  const [confirmViewAll, setConfirmViewAll] = useState(false)

  const selectedSet = new Set(selected || [])
  const recommended = new Set(policy?.recommended || baseline || [])
  const ownerLevel = new Set(policy?.ownerLevel || [])
  const baselineSet = baseline ? new Set(baseline) : null
  const allKeys = catalog.flatMap((group) => (group.items || []).map(([, key]) => key))

  // Every permission is adjustable for every role.
  const isOutsideNormal = (key) => recommended.size > 0 && !recommended.has(key)
  const isLocked = () => disabled
  const effectiveChecked = (key) => selectedSet.has(key)
  const optionalKeys = allKeys
  const optionalViewKeys = optionalKeys.filter((key) => getPermissionType(key) === 'View')
  const commit = (next) => onChange?.([...next])

  const added = baselineSet ? optionalKeys.filter((key) => selectedSet.has(key) && !baselineSet.has(key)) : []
  const removed = baselineSet ? optionalKeys.filter((key) => !selectedSet.has(key) && baselineSet.has(key)) : []
  const changedSet = new Set([...added, ...removed])
  const grantedCount = allKeys.filter((key) => effectiveChecked(key)).length
  const outsideSelected = optionalKeys.filter((key) => selectedSet.has(key) && isOutsideNormal(key))

  const toggle = (key) => {
    if (isLocked()) return
    const next = new Set(selectedSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    commit(next)
  }

  const toggleGroup = (group) => {
    if (disabled) return
    const keys = (group.items || []).map(([, key]) => key)
    const allSelected = keys.length > 0 && keys.every((key) => selectedSet.has(key))
    const next = new Set(selectedSet)
    keys.forEach((key) => allSelected ? next.delete(key) : next.add(key))
    commit(next)
  }

  // Levels a module actually offers. Levels that would grant the same keys as a
  // lower level are dropped (a module with only View permissions shows just
  // "No access" and "View only").
  const levelsFor = (group) => {
    const optional = (group.items || []).map(([, key]) => key)
    const levels = []
    ACCESS_LEVELS.forEach((level) => {
      const keys = new Set(optional.filter((key) => level.tiers.includes(getAccessTier(key))))
      if (levels.some((existing) => sameKeys(existing.keys, keys))) return
      levels.push({ ...level, keys })
    })
    return { optional, levels }
  }

  const levelOf = (group) => {
    const { optional, levels } = levelsFor(group)
    const current = new Set(optional.filter((key) => selectedSet.has(key)))
    return levels.find((level) => sameKeys(level.keys, current))?.value || 'custom'
  }

  const applyLevel = (group, level) => {
    if (disabled) return
    const { optional } = levelsFor(group)
    const next = new Set(selectedSet)
    optional.forEach((key) => next.delete(key))
    level.keys.forEach((key) => next.add(key))
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
  const orderedGroups = [...catalog].sort((a, b) => (priority.get(a.group) ?? 999) - (priority.get(b.group) ?? 999))

  // Details stay closed by default so the screen is one line per module.
  // Searching or filtering opens matching modules automatically.
  const isExpanded = (group) => Boolean(needle || filter !== 'all' || expanded[group.group])
  const setAllExpanded = (value) => setExpanded(Object.fromEntries(catalog.map((group) => [group.group, value])))

  const renderItem = (group, [label, key]) => {
    const type = getPermissionType(key)
    const changed = changedSet.has(key)
    const granted = effectiveChecked(key)
    const outsideNormal = granted && isOutsideNormal(key)
    const cardTone = outsideNormal ? tone.outside : tone.normal
    return <label key={key} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${cardTone} ${changed ? 'ring-2 ring-amber-300' : ''} ${isLocked() ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={granted} disabled={isLocked()} onChange={() => toggle(key)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600" />
      <span className="min-w-0">
        <span className="font-semibold">{cleanPermissionLabel(label)}</span>
        <span className="mt-1 flex flex-wrap gap-1 text-[10px] font-black">
          <span className={`rounded px-1.5 py-0.5 ${typeTone[type]}`}>{type}</span>
          {isSensitivePermission(key) ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">Sensitive</span> : null}
          {needsHeadApproval(key) ? <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-700">Needs Head approval</span> : null}
          {outsideNormal ? <span className="rounded bg-amber-200 px-1.5 py-0.5 text-amber-900">Outside normal role</span> : null}
          {outsideNormal && ownerLevel.has(key) ? <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">Usually System Admin only</span> : null}
          {changed ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">{selectedSet.has(key) ? 'Added' : 'Removed'}</span> : null}
        </span>
      </span>
    </label>
  }

  const renderModule = (group) => {
    const items = visibleItems(group)
    if ((needle || filter !== 'all') && !items.length) return null
    const groupKeys = (group.items || []).map(([, key]) => key)
    const optional = groupKeys
    const assignableKeys = groupKeys
    const grantedInGroup = assignableKeys.filter((key) => effectiveChecked(key)).length
    const allSelected = optional.length > 0 && optional.every((key) => selectedSet.has(key))
    const someSelected = optional.some((key) => selectedSet.has(key))
    const changedInGroup = groupKeys.filter((key) => changedSet.has(key)).length
    const outsideInGroup = optional.filter((key) => selectedSet.has(key) && isOutsideNormal(key)).length
    const open = isExpanded(group)
    const { levels } = levelsFor(group)
    const current = levelOf(group)
    return <section key={group.group} className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        <GroupCheckbox label={group.group} checked={allSelected} indeterminate={!allSelected && someSelected} disabled={disabled || !optional.length} onChange={() => toggleGroup(group)} />
        <button type="button" onClick={() => setExpanded((state) => ({ ...state, [group.group]: !open }))} className="flex min-w-[180px] flex-1 items-center gap-2 text-left" aria-expanded={open}>
          {open ? <FiChevronDown className="shrink-0 text-slate-400" /> : <FiChevronRight className="shrink-0 text-slate-400" />}
          <span className="min-w-0">
            <span className="block font-black text-slate-900">{group.group}</span>
            <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <span>{`${grantedInGroup} of ${assignableKeys.length}`} granted</span>
              {outsideInGroup ? <span className="rounded bg-amber-200 px-1.5 text-amber-900">Outside normal role</span> : null}
              {changedInGroup ? <span className="rounded bg-amber-100 px-1.5 text-amber-800">Changed</span> : null}
            </span>
          </span>
        </button>
        {(
          <div className="flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-black" role="radiogroup" aria-label={`${group.group} access level`}>
            {levels.map((level) => (
              <button key={level.value} type="button" role="radio" aria-checked={current === level.value} disabled={disabled} onClick={() => applyLevel(group, level)} title={level.keys.size ? `${level.keys.size} permission${level.keys.size === 1 ? '' : 's'}` : 'Removes every adjustable permission in this module'} className={`rounded-md px-2.5 py-1.5 disabled:cursor-not-allowed ${current === level.value ? levelTone[level.value] : 'text-slate-600 hover:bg-white'}`}>{level.label}</button>
            ))}
            {current === 'custom' ? <span className="rounded-md bg-amber-500 px-2.5 py-1.5 text-white" title="Individual permissions were chosen in Details">Custom</span> : null}
          </div>
        )}
      </div>
      {open ? <div className="grid gap-1.5 border-t border-slate-100 p-3 sm:grid-cols-2">
        {items.map((item) => renderItem(group, item))}
      </div> : null}
    </section>
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-600">Pick an access level for each module. Open a module to fine-tune single permissions.</p>
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <details className="text-xs font-semibold text-slate-600">
            <summary className="cursor-pointer font-black text-slate-700">What the levels and colors mean</summary>
            <div className="mt-2 grid gap-1.5">
              <p><span className="font-black">View only</span>: see records. <span className="font-black">Can edit</span>: also create, edit, export and print. <span className="font-black">Full access</span>: also delete and sensitive actions (money corrections, cancellations, releases). <span className="font-black">Custom</span>: individual permissions were chosen in a module's details.</p>
              <p>Every permission starts from the role default and can be changed. <span className="rounded bg-amber-200 px-1.5 text-amber-900">Outside normal role</span> marks access the role does not normally have; <span className="rounded bg-red-600 px-1.5 text-white">Usually System Admin only</span> marks owner-level access.</p>
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAllExpanded(true)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700">Show all details</button>
            <button type="button" onClick={() => setAllExpanded(false)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700">Hide all details</button>
            {!disabled ? <>
              <button type="button" onClick={grantAllView} disabled={!optionalViewKeys.length} className={`rounded-xl border px-3 py-2 text-xs font-black ${confirmViewAll ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700'} disabled:opacity-50`}>{confirmViewAll ? `Confirm: grant ${optionalViewKeys.length} view permissions` : 'Select all View'}</button>
              <button type="button" onClick={() => commit(new Set())} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700">Clear All</button>
            </> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        {orderedGroups.map(renderModule)}
      </div>
    </div>
  )
}

export default PermissionMatrix

