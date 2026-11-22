const labels = {
  dashboard:'Dashboard', reports:'Reports', projects:'Projects', 'lot-projects':'Lot Projects', 'house-lot-projects':'House & Lot Projects',
  listings:'Listings / Units', 'bulk-edit':'Bulk Edit Listings', 'payments-audit':'Payments Audit', commissions:'Commissions', settings:'Settings',
  'company-finances':'Company Finances', accredited:'Accredited Sellers', 'seller-groups':'Seller Networks', documents:'Documents',
  'document-templates':'Document Templates', users:'Users', notifications:'Notifications', 'audit-logs':'Audit Logs', 'review-center':'Review Center',
  reviews:'Review Details', 'access-control':'Access Control', 'data-integrity':'Data Integrity', 'proof-of-income':'Proof of Income', accounts:'Buyer Account',
}
export const listingTabLabels = {unit:'Unit & Status',client:'Client Profile',payments:'Payments & SOA',documents:'Documents',printouts:'Printouts'}
export function moduleBreadcrumb(pathname, {role='super_admin',projectName,search=''}={}) {
  const parts=pathname.replace(/^\/(?:portal|system)\/?/,'').split('/').filter(Boolean)
  const home=`/portal/${role}`, crumbs=[{label:'System',to:home}]
  let start=0
  if(parts[0]===role || /^(super_admin|system_admin|auditor|\w+_(?:head|staff))$/.test(parts[0]||''))start=1
  for(let index=start;index<parts.length;index++){
    const segment=parts[index],previous=parts[index-1]
    const label=previous==='lot-projects'?projectName||'Project Workspace':previous==='listings'&&segment!=='bulk-edit'?'Listing Profile':previous==='reviews'?'Review Details':previous==='accounts'?'Buyer Account':labels[segment]
    if(label)crumbs.push({label,to:'/portal/'+parts.slice(0,index+1).join('/')})
  }
  if(crumbs.length===1)crumbs.push({label:'Dashboard',to:home})
  const tab=new URLSearchParams(search).get('tab')
  if(crumbs.some(crumb=>crumb.label==='Listing Profile')&&listingTabLabels[tab])crumbs.push({label:listingTabLabels[tab],to:pathname+search})
  return {title:crumbs.at(-1).label,crumbs}
}
