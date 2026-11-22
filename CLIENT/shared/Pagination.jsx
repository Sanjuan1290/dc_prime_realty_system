import './pagination.css'

export default function Pagination({page, pageSize, total, onPageChange, onPageSizeChange, disabled=false, label='Pagination'}) {
  const pages=Math.max(1,Math.ceil(total/pageSize))
  const current=Math.max(1,Math.min(page,pages))
  const first=total?(current-1)*pageSize+1:0
  const last=Math.min(current*pageSize,total)
  return <nav className="dc-pagination" aria-label={label}>
    <p role="status">Showing {first}–{last} of {total}</p>
    <div className="dc-pagination-controls">
      <label>Rows per page<select value={pageSize} disabled={disabled} onChange={event=>onPageSizeChange(Number(event.target.value))}>
        {[10,20,50].map(size=><option key={size} value={size}>{size}</option>)}
      </select></label>
      <span>Page {current} of {pages}</span>
      <div className="dc-pagination-buttons">
        <button type="button" disabled={disabled||current<=1} onClick={()=>onPageChange(current-1)}>Previous</button>
        <button type="button" disabled={disabled||current>=pages} onClick={()=>onPageChange(current+1)}>Next</button>
      </div>
    </div>
  </nav>
}
