import {Link,useLocation} from 'react-router-dom'
import {moduleBreadcrumb} from '../../utils/moduleBreadcrumb'

export default function ModuleBreadcrumb({role,projectName}) {
  const location=useLocation(),module=moduleBreadcrumb(location.pathname,{role,projectName,search:location.search})
  return <section className="mb-5 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3">
    <nav aria-label="Module breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
      {module.crumbs.map((crumb,index)=><span key={index} className="flex min-w-0 items-center gap-2">{index>0&&<span aria-hidden="true">/</span>}{index===module.crumbs.length-1?<span aria-current="page" className="break-words text-slate-700">{crumb.label}</span>:<Link to={crumb.to} className="break-words hover:text-blue-700">{crumb.label}</Link>}</span>)}
    </nav><h2 className="mt-1 text-lg font-black text-slate-950">{module.title}</h2>
  </section>
}
