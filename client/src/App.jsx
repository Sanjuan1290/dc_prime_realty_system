import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
} from 'react-router-dom'

import Login from './auth/Login'
import ChangePassword from './auth/ChangePassword'
import SystemLayout from './layout/SystemLayout'
import AdminLayout from './layout/adminLayout'
import LotLayout from './layout/LotLayout'
import ProtectedPermissionRoute from './components/Auth/ProtectedPermissionRoute'
import { PERMISSIONS } from './config/permissions'

import Dashboard from './pages/System/Dashboard'
import Documents from './pages/System/Documents'
import SellerGroup from './pages/System/SellerGroup'
import Users from './pages/System/Users'
import Accredited from './pages/System/Accredited'
import Projects from './pages/System/Projects'
import Notifications from './pages/System/Notifications'
import AuditLogs from './pages/System/AuditLogs'
import Settings from './pages/System/Settings'
import Employees from './pages/System/Employees'
import Attendance from './pages/System/Attendance'
import EmployeeCashAdvances from './pages/System/EmployeeCashAdvances'
import HouseLotProjects from './pages/System/HouseLotProjects'

import LotDashboard from './pages/Lot_Projects/Dashboard'
import LotListings from './pages/Lot_Projects/Listings'
import LotListingProfile from './pages/Lot_Projects/ListingProfile'
import LotPaymentLogs from './pages/Lot_Projects/PaymentLogs'
import LotCommission from './pages/Lot_Projects/Commission'
import LotSettings from './pages/Lot_Projects/Settings'

import OfferToBuyPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyPrintPage'
import SOAPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/SOAPrintPage'
import DocumentsPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/DocumentsPrintPage'
import AccreditedSellerProofOfIncomePrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage'
import ProjectPriceListPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/ProjectPriceListPrintPage'
import EmployeeSalaryReleasePrintPage from './components/System/employeeComponents/prints/EmployeeSalaryReleasePrintPage'
import EmployeeLogbookPrintPage from './components/System/employeeComponents/prints/EmployeeLogbookPrintPage'

const protect = (permission, element) => <ProtectedPermissionRoute permission={permission}>{element}</ProtectedPermissionRoute>

const App = () => {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />

        <Route path="/super_admin" element={<SystemLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="house-lot-projects" element={<HouseLotProjects />} />
          <Route path="documents" element={<Documents />} />
          <Route path="users" element={<Users />} />
          <Route path="accredited" element={<Accredited />} />
          <Route path="users/seller_group" element={<SellerGroup />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="cash-advances" element={<EmployeeCashAdvances />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="projects" replace />} />
          <Route path="projects" element={<Projects />} />
          <Route path="house-lot-projects" element={<HouseLotProjects />} />
          <Route path="documents" element={<Documents />} />
          <Route path="users" element={<Users />} />
          <Route path="users/seller_group" element={<SellerGroup />} />
          <Route path="accredited" element={<Accredited />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="cash-advances" element={<Navigate to="/admin/employees" replace />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="/lot-projects/:projectSlug" element={<LotLayout />}>
          <Route index element={protect(PERMISSIONS.LOT_DASHBOARD_VIEW, <LotDashboard />)} />
          <Route path="listings" element={protect(PERMISSIONS.LOT_LISTINGS_VIEW, <LotListings />)} />
          <Route path="listings/:listingId" element={protect(PERMISSIONS.LOT_LISTINGS_VIEW, <LotListingProfile />)} />
          <Route path="payments-audit" element={protect(PERMISSIONS.LOT_PAYMENT_LOGS_VIEW, <LotPaymentLogs />)} />
          <Route path="commissions" element={protect(PERMISSIONS.LOT_COMMISSIONS_VIEW, <LotCommission />)} />
          <Route path="settings" element={protect(PERMISSIONS.LOT_SETTINGS_VIEW, <LotSettings />)} />
        </Route>

        <Route path="/lot-projects/:projectSlug/printouts/offer-to-buy" element={<OfferToBuyPrintPage />} />
        <Route path="/lot-projects/:projectSlug/printouts/statement-of-account" element={<SOAPrintPage />} />
        <Route path="/super_admin/accredited/proof-of-income/print" element={<AccreditedSellerProofOfIncomePrintPage />} />
        <Route path="/lot-projects/:projectSlug/printouts/documents" element={<DocumentsPrintPage />} />
        <Route path="/lot-projects/:projectSlug/price-list/print" element={<ProjectPriceListPrintPage />} />
        <Route path="/employee-payroll/release/print" element={protect(PERMISSIONS.PAYROLL_VIEW, <EmployeeSalaryReleasePrintPage />)} />
        <Route path="/employee-payroll/logbook/print" element={protect(PERMISSIONS.ATTENDANCE_VIEW, <EmployeeLogbookPrintPage />)} />
      </>
    )
  )

  return <RouterProvider router={router} />
}

export default App
