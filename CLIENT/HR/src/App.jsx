import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { PERMISSIONS, hasPermission } from './config/permissions'
import { HR_FEATURE_FLAGS } from './config/featureFlags'
import HrLayout from './layout/HrLayout'
import HrLogin from './auth/HrLogin'
import useCurrentUser from './utils/useCurrentUser'
const Employees=lazy(()=>import('./pages/System/Employees'))
const Attendance=lazy(()=>import('./pages/System/Attendance'))
const Payroll=lazy(()=>import('./pages/System/EmployeeSalary'))
const Kiosk=lazy(()=>import('./pages/Public/AttendanceKiosk'))
const ProtectedPage=({permission,children})=>{
  const current=useCurrentUser();if(current.isPending)return <p>Checking permission…</p>
  if(current.isError)return <Navigate to="/login" replace/>
  if(!hasPermission(current.data?.user,permission))return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">You do not have permission to view this HR section.</p>
  return children
}
const Landing = () => {
  const current=useCurrentUser();if(current.isPending)return <p>Loading HR…</p>
  const permissions=current.data?.user?.permissions || []
  for(const [permission,path] of [[PERMISSIONS.EMPLOYEES_VIEW,'/employees'],[PERMISSIONS.ATTENDANCE_VIEW,'/attendance-records'],[PERMISSIONS.EMPLOYEE_SALARY_VIEW,'/payroll']]){
    if(permissions.includes(permission))return <Navigate to={path} replace/>
  }
  return <p>No HR modules are assigned to this account.</p>
}
const router=createBrowserRouter([
  {path:'/login',element:<HrLogin/>},
  {path:'/kiosk',element:HR_FEATURE_FLAGS.kiosk?<Kiosk/>:<main className="p-8"><h1 className="text-lg font-bold">HR attendance kiosk unavailable</h1><p>Kiosk mode is disabled until HR staging validation.</p></main>},
  {path:'/',element:<HrLayout/>,children:[
    {index:true,element:<Landing/>},
    {path:'employees',element:<ProtectedPage permission={PERMISSIONS.EMPLOYEES_VIEW}><Employees/></ProtectedPage>},
    {path:'attendance-records',element:<ProtectedPage permission={PERMISSIONS.ATTENDANCE_VIEW}><Attendance/></ProtectedPage>},
    {path:'payroll',element:<ProtectedPage permission={PERMISSIONS.EMPLOYEE_SALARY_VIEW}><Payroll/></ProtectedPage>},
  ]},
  {path:'*',element:<Navigate to="/" replace/>}
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' })
export default function App(){return <Suspense fallback={<main className="p-8">Loading HR module…</main>}><RouterProvider router={router}/></Suspense>}

