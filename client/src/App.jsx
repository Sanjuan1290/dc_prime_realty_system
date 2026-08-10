import { lazy, Suspense } from 'react'
import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  useLocation,
} from 'react-router-dom'

import Login from './auth/Login'
import ChangePassword from './auth/ChangePassword'
import BuyerForm from './pages/Public/BuyerForm'
import SystemLayout from './layout/SystemLayout'
import LotLayout from './layout/LotLayout'
import ProtectedPermissionRoute from './components/Auth/ProtectedPermissionRoute'
import RouteErrorPage from './components/Shared/RouteErrorPage'
import Maintenance from './pages/System/Maintenance'
import ServerDown from './pages/System/ServerDown'
import { PERMISSIONS } from './config/permissions'
import WebsiteLayout from './website/layouts/WebsiteLayout'
import WebsiteSavedProjects from './website/pages/SavedProjects'
import WebsiteVisitChecklist from './website/pages/VisitChecklistPage'
import WebsitePaymentEstimator from './website/pages/PaymentEstimator'
import WebsitePrivacyNotice  from './website/pages/PrivacyNotice'
import WebsiteTermsOfUse from './website/pages/TermsOfUse'
import WebsiteDisclaimer from './website/pages/Disclaimer'
import './website/styles/website.css'


const WebsiteHome = lazy(() => import('./website/pages/Home'))
const WebsiteAboutUs = lazy(() => import('./website/pages/AboutUs'))
const WebsiteProperties = lazy(() => import('./website/pages/Properties'))
const WebsitePropertyDetails = lazy(() => import('./website/pages/PropertyDetails'))
const WebsiteBlog = lazy(() => import('./website/pages/Blog'))
const WebsiteBlogDetails = lazy(() => import('./website/pages/BlogDetails'))
const WebsiteFAQs = lazy(() => import('./website/pages/FAQs'))
const WebsiteSiteCoordinator = lazy(() => import('./website/pages/SiteCoordinator'))
const WebsiteSellers = lazy(() => import('./website/pages/Sellers'))
const WebsiteContactUs = lazy(() => import('./website/pages/ContactUs'))
const WebsiteNotFound = lazy(() => import('./website/pages/NotFound'))

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
import PaymentAcknowledgementReceiptsPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/PaymentAcknowledgementReceiptsPrintPage'
import DocumentsPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/DocumentsPrintPage'
import AccreditedSellerProofOfIncomePrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage'
import AccreditedSellerIncomeRangePrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerIncomeRangePrintPage'
import ProjectPriceListPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/ProjectPriceListPrintPage'
import EmployeeSalaryReleasePrintPage from './components/System/employeeComponents/prints/EmployeeSalaryReleasePrintPage'
import EmployeeLogbookPrintPage from './components/System/employeeComponents/prints/EmployeeLogbookPrintPage'


const LegacyPortalRedirect = () => {
  const location = useLocation()

  return (
    <Navigate
      to={`/portal${location.pathname}${location.search}${location.hash}`}
      replace
    />
  )
}

const protect = (permission, element) => (
  <ProtectedPermissionRoute permission={permission}>
    {element}
  </ProtectedPermissionRoute>
)

const App = () => {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/" element={<WebsiteLayout />} errorElement={<RouteErrorPage />}>
          <Route index element={<WebsiteHome />} />
          <Route path="about-us" element={<WebsiteAboutUs />} />
          <Route path="properties" element={<WebsiteProperties />} />
          <Route path="properties/:projectSlug" element={<WebsitePropertyDetails />} />
          <Route path="blog" element={<WebsiteBlog />} />
          <Route path="blog/:blogSlug" element={<WebsiteBlogDetails />} />
          <Route path="faqs" element={<WebsiteFAQs />} />
          <Route path="site-coordinator" element={<WebsiteSiteCoordinator />} />
          <Route path="sellers" element={<WebsiteSellers />} />
          <Route path="contact-us" element={<WebsiteContactUs />} />
          <Route path="saved-projects" element={<WebsiteSavedProjects />} />
          <Route path="visit-checklist" element={<WebsiteVisitChecklist />} />
          <Route path="payment-estimator" element={<WebsitePaymentEstimator />} />
          <Route path="privacy-policy" element={<WebsitePrivacyNotice />} />
          <Route path="terms-of-use" element={<WebsiteTermsOfUse />} />
          <Route path="disclaimer" element={<WebsiteDisclaimer />} />
          <Route path="*" element={<WebsiteNotFound />} />
        </Route>

        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/server-down" element={<ServerDown />} />
      
        <Route path="/portal" element={<Login />} />
        <Route path="/portal/login" element={<Navigate to="/portal" replace />} />
        <Route path="/portal/change-password" element={<ChangePassword />} />

        {/* Public client form stays outside the internal portal. */}
        <Route path="/buyer-form/:token" element={<BuyerForm />} />

        {/* Keep old bookmarks working while all internal URLs move to /portal. */}
        <Route path="/change-password" element={<LegacyPortalRedirect />} />
        <Route path="/admin/*" element={<LegacyPortalRedirect />} />
        <Route path="/super_admin/*" element={<LegacyPortalRedirect />} />
        <Route path="/lot-projects/*" element={<LegacyPortalRedirect />} />
        <Route path="/house-lot-projects/*" element={<LegacyPortalRedirect />} />
        <Route path="/employee-payroll/*" element={<LegacyPortalRedirect />} />

        <Route path="/portal/super_admin" element={<SystemLayout />} errorElement={<RouteErrorPage />}>
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
          <Route path="users/seller_group" element={<Navigate to="/portal/super_admin/users/groups/in-house" replace />} />
          <Route path="users/groups/in-house" element={<SellerGroup groupType="in_house" />} />
          <Route path="users/groups/in-house/:groupId" element={<SellerGroupDetails expectedGroupType="in_house" />} />
          <Route path="users/groups/external" element={<SellerGroup groupType="external" />} />
          <Route path="users/groups/external/:groupId" element={<SellerGroupDetails expectedGroupType="external" />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          {/* <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="cash-advances" element={<EmployeeCashAdvances />} /> */}

          <Route path="employees" element={
            <p className='text-4xl font-extrabold '>On Going... 🧒</p>
          } />
          <Route path="attendance" element={
            <p className='text-4xl font-extrabold '>On Going... 🧒</p>
          } />
          <Route path="cash-advances" element={
            <p className='text-4xl font-extrabold '>On Going... 🧒</p>
          } />

          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="/portal/admin" element={<SystemLayout />} errorElement={<RouteErrorPage />}>
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
          <Route path="users/seller_group" element={<Navigate to="/portal/admin/users/groups/in-house" replace />} />
          <Route path="users/groups/in-house" element={<SellerGroup groupType="in_house" />} />
          <Route path="users/groups/in-house/:groupId" element={<SellerGroupDetails expectedGroupType="in_house" />} />
          <Route path="users/groups/external" element={<SellerGroup groupType="external" />} />
          <Route path="users/groups/external/:groupId" element={<SellerGroupDetails expectedGroupType="external" />} />
          <Route path="accredited" element={<Accredited />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="cash-advances" element={<EmployeeCashAdvances />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="/portal/lot-projects/:projectSlug" element={<LotLayout />} errorElement={<RouteErrorPage />}>
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
            path="listings/:listingId/accounts/:accountId"
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
          path="/portal/lot-projects/:projectSlug/printouts/offer-to-buy"
          element={<OfferToBuyPrintPage />}
        />
        <Route
          path="/portal/lot-projects/:projectSlug/printouts/statement-of-account"
          element={<SOAPrintPage />}
        />
        <Route
          path="/portal/lot-projects/:projectSlug/printouts/acknowledgement-receipts"
          element={<PaymentAcknowledgementReceiptsPrintPage />}
        />
        <Route
          path="/portal/super_admin/accredited/proof-of-income/print"
          element={<AccreditedSellerProofOfIncomePrintPage />}
        />
        <Route
          path="/portal/super_admin/accredited/proof-of-income/range/print"
          element={<AccreditedSellerIncomeRangePrintPage />}
        />
        <Route
          path="/portal/lot-projects/:projectSlug/printouts/documents"
          element={<DocumentsPrintPage />}
        />
        <Route
          path="/portal/lot-projects/:projectSlug/price-list/print"
          element={<ProjectPriceListPrintPage />}
        />
        <Route
          path="/portal/employee-payroll/release/print"
          element={protect(
            PERMISSIONS.PAYROLL_VIEW,
            <EmployeeSalaryReleasePrintPage />
          )}
        />
        <Route
          path="/portal/employee-payroll/logbook/print"
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



