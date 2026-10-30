import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { PERMISSIONS, hasPermission } from '../config/permissions'
import { HR_FEATURE_FLAGS } from '../config/featureFlags'
import { requestApi } from '../utils/apiClient'
import useCurrentUser from '../utils/useCurrentUser'
const links = [
  {path:'/employees',name:'Employees',permission:PERMISSIONS.EMPLOYEES_VIEW},
  {path:'/attendance-records',name:'Attendance',permission:PERMISSIONS.ATTENDANCE_VIEW},
  {path:'/payroll',name:'Payroll',permission:PERMISSIONS.EMPLOYEE_SALARY_VIEW},
]
const HrLayout = () => {
  const userQuery = useCurrentUser();const cache=useQueryClient();const navigate=useNavigate()
  const signOut = async() => {try{await requestApi('/auth/logout',{method:'POST'})}finally{cache.clear();navigate('/login',{replace:true})}}
  if (userQuery.isPending) return <main className="p-8">Checking HR session…</main>
  if (userQuery.isError) return <Navigate to="/login" replace />
  const user=userQuery.data?.user
  if (!user) return <Navigate to="/login" replace />
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white px-4 py-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">D&amp;C Prime Realty</p><p className="text-xl font-bold">HR &amp; Payroll</p></div>
        <div className="flex items-center gap-4 text-sm"><span className="text-slate-600">{user.displayName || 'HR user'}</span><button type="button" onClick={signOut} className="rounded-lg border px-3 py-2">Sign out</button></div>
      </div>
      <nav className="mx-auto mt-4 flex max-w-7xl flex-wrap gap-2" aria-label="HR navigation">
        {links.filter(link=>hasPermission(user,link.permission)).map(link=><NavLink key={link.path} to={link.path} className={({isActive})=>`rounded-lg px-4 py-2 text-sm font-semibold ${isActive?'bg-blue-700 text-white':'bg-slate-100 text-slate-700'}`}>{link.name}</NavLink>)}
      </nav>
    </header>
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      {!HR_FEATURE_FLAGS.stagingWrites && <div role="status" className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><strong>HR staging: read-only.</strong> Editing is disabled until database verification and an approved staging write test.</div>}
      <Outlet/>
    </main>
  </div>
}
export default HrLayout
