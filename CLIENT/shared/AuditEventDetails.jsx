import {useEffect, useRef} from 'react'
import {auditDetails, auditLabel, auditValue} from './auditDetails.js'
import './AuditEventDetails.css'

function Value({value,field}) {
  if (value === null || value === undefined || value === '') return <span className="audit-muted">Not recorded</span>
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>
  if (Array.isArray(value)) return value.length ? <ol className="audit-array">{value.map((item, index) => <li key={index}><Value value={item}/></li>)}</ol> : <span className="audit-muted">None</span>
  if (typeof value === 'object') {
    if (value.before && value.after && typeof value.before === 'object' && typeof value.after === 'object') {
      const keys = [...new Set([...Object.keys(value.before), ...Object.keys(value.after)])]
      return <><div className="audit-table-wrap"><table className="audit-changes"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>{keys.map(key => <tr key={key}><th>{auditLabel(key)}</th><td><Value value={value.before[key]} field={key}/></td><td><Value value={value.after[key]} field={key}/></td></tr>)}</tbody></table></div><Fields value={Object.fromEntries(Object.entries(value).filter(([key]) => !['before','after'].includes(key)))}/></>
    }
    return <Fields value={value}/>
  }
  return <span>{auditValue(value,field)}</span>
}
function Fields({value}) {
  return <dl className="audit-fields">{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{key==='metadata'?'Change details':auditLabel(key)}</dt><dd><Value value={entry} field={key}/></dd></div>)}</dl>
}
export default function AuditEventDetails({event, onClose}) {
  const close = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    close.current?.focus()
    const keyboard = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') { e.preventDefault(); close.current?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus?.() }
  }, [onClose])
  const details = auditDetails(event.details_json ?? event.metadata_json)
  return <div className="audit-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-label="Audit event details" className="audit-dialog">
    <header><div><p className="audit-eyebrow">Audit event</p><h2>{details.title || auditLabel(event.action)}</h2></div><button type="button" ref={close} onClick={onClose}>Close</button></header>
    <dl className="audit-summary"><div><dt>Recorded by</dt><dd>{event.actor_name_snapshot || event.actor_name || (event.actor_user_id ? `User #${event.actor_user_id}` : 'System')}</dd></div><div><dt>Recorded (Asia/Manila)</dt><dd>{event.recorded_at || event.created_at || 'Not recorded'}</dd></div><div><dt>Record</dt><dd>{details.entityLabel || `${auditLabel(event.entity_type)} #${event.entity_id ?? '—'}`}</dd></div></dl>
    {details.description && <p className="audit-description">{details.description}</p>}
    <Value value={Object.fromEntries(Object.entries(details).filter(([key]) => !['title','description','entityLabel'].includes(key)))}/>
    {!Object.keys(details).length && <p className="audit-muted">No additional details were recorded for this event.</p>}
  </section></div>
}
