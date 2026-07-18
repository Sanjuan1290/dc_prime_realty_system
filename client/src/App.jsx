import { lazy, Suspense } from 'react'
import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
} from 'react-router-dom'

import Login from './auth/Login'
import ChangePassword from './auth/ChangePassword'
import BuyerForm from './pages/Public/BuyerForm'
import SystemLayout from './layout/SystemLayout'
import AdminLayout from './layout/adminLayout'
import LotLayout from './layout/LotLayout'
import ProtectedPermissionRoute from './components/Auth/ProtectedPermissionRoute'
import { PERMISSIONS } from './config/permissions'

const Dashboard = lazy(() => import('./pages/System/Dashboard'))
const Documents = lazy(() => import('./pages/System/Documents'))
const SellerGroup = lazy(() => import('./pages/System/SellerGroup'))
const SellerGroupDetails = lazy(() => import('./pages/System/SellerGroupDetails'))
const Users = lazy(() => import('./pages/System/Users'))
const Accredited = lazy(() => import('./pages/System/Accredited'))
const Projects = lazy(() => import('./pages/System/Projects'))
const ProjectWorkspaceList = lazy(() => import('./pages/System/ProjectWorkspaceList'))
const Notifications = lazy(() => import('./pages/System/Notifications'))
const AuditLogs = lazy(() => import('./pages/System/AuditLogs'))
const Settings = lazy(() => import('./pages/System/Settings'))
const Employees = lazy(() => import('./pages/System/Employees'))
const Attendance = lazy(() => import('./pages/System/Attendance'))
const EmployeeCashAdvances = lazy(() => import('./pages/System/EmployeeCashAdvances'))

const LotDashboard = lazy(() => import('./pages/Lot_Projects/Dashboard'))
const LotListings = lazy(() => import('./pages/Lot_Projects/Listings'))
const LotListingProfile = lazy(() => import('./pages/Lot_Projects/ListingProfile'))
const LotPaymentLogs = lazy(() => import('./pages/Lot_Projects/PaymentLogs'))
const LotCommission = lazy(() => import('./pages/Lot_Projects/Commission'))
const LotSettings = lazy(() => import('./pages/Lot_Projects/Settings'))


import OfferToBuyPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyPrintPage'
import SOAPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/SOAPrintPage'
import DocumentsPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/DocumentsPrintPage'
import AccreditedSellerProofOfIncomePrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage'
import AccreditedSellerIncomeRangePrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerIncomeRangePrintPage'
import ProjectPriceListPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/ProjectPriceListPrintPage'
import EmployeeSalaryReleasePrintPage from './components/System/employeeComponents/prints/EmployeeSalaryReleasePrintPage'
import EmployeeLogbookPrintPage from './components/System/employeeComponents/prints/EmployeeLogbookPrintPage'

const protect = (permission, element) => (
  <ProtectedPermissionRoute permission={permission}>
    {element}
  </ProtectedPermissionRoute>
)

const App = () => {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/buyer-form/:token" element={<BuyerForm />} />

        <Route path="/super_admin" element={<SystemLayout />}>
          <Route index element={<Dashboard />} />

          <Route path="projects" element={<Projects />} />

          <Route
            path="lot-projects"
            element={<ProjectWorkspaceList type="lot" />}
          />

          <Route
            path="house-lot-projects"
            element={<ProjectWorkspaceList type="house_lot" />}
          />

          <Route path="documents" element={<Documents />} />
          <Route path="users" element={<Users />} />
          <Route path="accredited" element={<Accredited />} />
          <Route path="users/seller_group" element={<SellerGroup />} />
          <Route path="users/seller_group/:groupId" element={<SellerGroupDetails />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="cash-advances" element={<EmployeeCashAdvances />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="projects" element={<Projects />} />

          <Route
            path="lot-projects"
            element={<ProjectWorkspaceList type="lot" />}
          />

          <Route
            path="house-lot-projects"
            element={<ProjectWorkspaceList type="house_lot" />}
          />

          <Route path="documents" element={<Documents />} />
          <Route path="users" element={<Users />} />
          <Route path="users/seller_group" element={<SellerGroup />} />
          <Route path="users/seller_group/:groupId" element={<SellerGroupDetails />} />
          <Route path="accredited" element={<Accredited />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route
            path="cash-advances"
            element={<Navigate to="/admin/employees" replace />}
          />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="/lot-projects/:projectSlug" element={<LotLayout />}>
          <Route
            index
            element={protect(
              PERMISSIONS.LOT_DASHBOARD_VIEW,
              <LotDashboard />
            )}
          />
          <Route
            path="listings"
            element={protect(
              PERMISSIONS.LOT_LISTINGS_VIEW,
              <LotListings />
            )}
          />
          <Route
            path="listings/:listingId"
            element={protect(
              PERMISSIONS.LOT_LISTINGS_VIEW,
              <LotListingProfile />
            )}
          />
          <Route
            path="payments-audit"
            element={protect(
              PERMISSIONS.LOT_PAYMENT_LOGS_VIEW,
              <LotPaymentLogs />
            )}
          />
          <Route
            path="commissions"
            element={protect(
              PERMISSIONS.LOT_COMMISSIONS_VIEW,
              <LotCommission />
            )}
          />
          <Route
            path="settings"
            element={protect(
              PERMISSIONS.LOT_SETTINGS_VIEW,
              <LotSettings />
            )}
          />
        </Route>

        <Route
          path="/lot-projects/:projectSlug/printouts/offer-to-buy"
          element={<OfferToBuyPrintPage />}
        />
        <Route
          path="/lot-projects/:projectSlug/printouts/statement-of-account"
          element={<SOAPrintPage />}
        />
        <Route
          path="/super_admin/accredited/proof-of-income/print"
          element={<AccreditedSellerProofOfIncomePrintPage />}
        />
        <Route
          path="/super_admin/accredited/proof-of-income/range/print"
          element={<AccreditedSellerIncomeRangePrintPage />}
        />
        <Route
          path="/lot-projects/:projectSlug/printouts/documents"
          element={<DocumentsPrintPage />}
        />
        <Route
          path="/lot-projects/:projectSlug/price-list/print"
          element={<ProjectPriceListPrintPage />}
        />
        <Route
          path="/employee-payroll/release/print"
          element={protect(
            PERMISSIONS.PAYROLL_VIEW,
            <EmployeeSalaryReleasePrintPage />
          )}
        />
        <Route
          path="/employee-payroll/logbook/print"
          element={protect(
            PERMISSIONS.ATTENDANCE_VIEW,
            <EmployeeLogbookPrintPage />
          )}
        />
      </>
    )
  )

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-black text-slate-600">
          Loading workspace...
        </div>
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  )
}

export default App
