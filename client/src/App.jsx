import { lazy, Suspense } from 'react'
import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  useLocation,
  useParams,
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
import { PERMISSIONS, SYSTEM_USER_ROLES } from './config/permissions'
import WebsiteLayout from './website/layouts/WebsiteLayout'
import WebsiteSavedProjects from './website/pages/SavedProjects'
import WebsiteVisitChecklist from './website/pages/VisitChecklistPage'
import WebsitePaymentEstimator from './website/pages/PaymentEstimator'
import WebsitePrivacyNotice from './website/pages/PrivacyNotice'
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
const Reports = lazy(() => import('./pages/System/Reports'))
const Documents = lazy(() => import('./pages/System/Documents'))
const SellerGroup = lazy(() => import('./pages/System/SellerGroup'))
const SellerGroupDetails = lazy(() => import('./pages/System/SellerGroupDetails'))
const Users = lazy(() => import('./pages/System/Users'))
const Accredited = lazy(() => import('./pages/System/Accredited'))
const Projects = lazy(() => import('./pages/System/Projects'))
const ProjectWorkspaceList = lazy(() => import('./pages/System/ProjectWorkspaceList'))
const Notifications = lazy(() => import('./pages/System/Notifications'))
const AuditLogs = lazy(() => import('./pages/System/AuditLogs'))
const DataIntegrityAccess = lazy(() => import('./pages/System/DataIntegrityAccess'))
const Settings = lazy(() => import('./pages/System/Settings'))
const AccessDenied = lazy(() => import('./pages/System/AccessDenied'))
const Employees = lazy(() => import('./pages/System/Employees'))
const Attendance = lazy(() => import('./pages/System/Attendance'))
const AttendanceKiosk = lazy(() => import('./pages/Public/AttendanceKiosk'))

const LotDashboard = lazy(() => import('./pages/Lot_Projects/Dashboard'))
const LotReports = lazy(() => import('./pages/Lot_Projects/Reports'))
const LotListings = lazy(() => import('./pages/Lot_Projects/Listings'))
const LotListingProfile = lazy(() => import('./pages/Lot_Projects/ListingProfile'))
const LotPaymentLogs = lazy(() => import('./pages/Lot_Projects/PaymentLogs'))
const LotCommission = lazy(() => import('./pages/Lot_Projects/Commission'))
const LotSettings = lazy(() => import('./pages/Lot_Projects/Settings'))

import OfferToBuyPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyPrintPage'
import SOAPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/SOAPrintPage'
import PaymentAcknowledgementReceiptsPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/PaymentAcknowledgementReceiptsPrintPage'
import DocumentsPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/DocumentsPrintPage'
import SignedReceiptsPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/SignedReceiptsPrintPage'
import AccreditedSellerProofOfIncomePrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage'
import AccreditedSellerIncomeRangePrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerIncomeRangePrintPage'
import ProjectPriceListPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/ProjectPriceListPrintPage'
import ReportsPrintPage from './pages/System/ReportsPrintPage'

const LegacyPortalRedirect = () => {
  const location = useLocation()
  return <Navigate to={`/portal${location.pathname}${location.search}${location.hash}`} replace />
}

const LegacySellerGroupRedirect = ({ groupType }) => {
  const location = useLocation()
  const { groupId } = useParams()
  const portalRole = location.pathname.split('/')[2] || 'super_admin'
  const groupPath = groupType === 'external' ? 'external' : 'in-house'
  const target = `/portal/${portalRole}/accredited/groups/${groupPath}${groupId ? `/${groupId}` : ''}${location.search}${location.hash}`
  return <Navigate to={target} replace />
}

const protect = (permission, element, options = {}) => (
  <ProtectedPermissionRoute permission={permission} {...options}>{element}</ProtectedPermissionRoute>
)

const systemRoleRoutes = SYSTEM_USER_ROLES.map((role) => (
  <Route key={role} path={`/portal/${role}`} element={<SystemLayout />} errorElement={<RouteErrorPage />}>
    <Route index element={protect(PERMISSIONS.SYSTEM_DASHBOARD_VIEW, <Dashboard />)} />
    <Route path="dashboard" element={<Navigate to={`/portal/${role}`} replace />} />
    <Route path="reports" element={protect(PERMISSIONS.SYSTEM_REPORTS_VIEW, <Reports />)} />
    <Route path="projects" element={protect(PERMISSIONS.SYSTEM_PROJECTS_VIEW, <Projects />)} />
    <Route path="lot-projects" element={protect(PERMISSIONS.LOT_PROJECT_VIEW, <ProjectWorkspaceList type="lot" />)} />
    <Route path="documents" element={protect(PERMISSIONS.SYSTEM_DOCUMENTS_VIEW, <Documents />)} />
    <Route path="users" element={protect(PERMISSIONS.SYSTEM_USERS_VIEW, <Users />)} />
    <Route path="accredited" element={protect(PERMISSIONS.SYSTEM_ACCREDITED_VIEW, <Accredited />)} />
    <Route path="accredited/groups/in-house" element={protect(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW, <SellerGroup groupType="in_house" />)} />
    <Route path="accredited/groups/in-house/:groupId" element={protect(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW, <SellerGroupDetails expectedGroupType="in_house" />)} />
    <Route path="accredited/groups/external" element={protect(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW, <SellerGroup groupType="external" />)} />
    <Route path="accredited/groups/external/:groupId" element={protect(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW, <SellerGroupDetails expectedGroupType="external" />)} />
    <Route path="users/seller_group" element={<LegacySellerGroupRedirect groupType="in_house" />} />
    <Route path="users/groups/in-house" element={<LegacySellerGroupRedirect groupType="in_house" />} />
    <Route path="users/groups/in-house/:groupId" element={<LegacySellerGroupRedirect groupType="in_house" />} />
    <Route path="users/groups/external" element={<LegacySellerGroupRedirect groupType="external" />} />
    <Route path="users/groups/external/:groupId" element={<LegacySellerGroupRedirect groupType="external" />} />
    <Route path="notifications" element={protect(PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW, <Notifications />)} />
    <Route path="audit-logs" element={protect(PERMISSIONS.AUDIT_LOGS_VIEW, <AuditLogs />)} />
    <Route path="employees" element={protect(PERMISSIONS.EMPLOYEES_VIEW, <Employees />)} />
    <Route path="attendance" element={protect(PERMISSIONS.ATTENDANCE_VIEW, <Attendance />)} />
    <Route path="settings" element={protect(PERMISSIONS.SYSTEM_SETTINGS_VIEW, <Settings />)} />
  </Route>
))

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

        <Route path="/attendance" element={<AttendanceKiosk />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/server-down" element={<ServerDown />} />
        <Route path="/portal" element={<Login />} />
        <Route path="/portal/login" element={<Navigate to="/portal" replace />} />
        <Route path="/portal/change-password" element={<ChangePassword />} />
        <Route path="/portal/access-denied" element={<AccessDenied />} />
        <Route path="/portal/data-integrity" element={<DataIntegrityAccess />} />
        <Route path="/buyer-form/:token" element={<BuyerForm />} />

        <Route path="/change-password" element={<LegacyPortalRedirect />} />
        <Route path="/admin/*" element={<LegacyPortalRedirect />} />
        <Route path="/super_admin/*" element={<LegacyPortalRedirect />} />
        <Route path="/marketing/*" element={<LegacyPortalRedirect />} />
        <Route path="/sales/*" element={<LegacyPortalRedirect />} />
        <Route path="/accounting/*" element={<LegacyPortalRedirect />} />
        <Route path="/operations/*" element={<LegacyPortalRedirect />} />
        <Route path="/lot-projects/*" element={<LegacyPortalRedirect />} />
        <Route path="/house-lot-projects/*" element={<LegacyPortalRedirect />} />

        {systemRoleRoutes}

        <Route path="/portal/lot-projects/:projectSlug" element={<LotLayout />} errorElement={<RouteErrorPage />}>
          <Route index element={protect(PERMISSIONS.LOT_DASHBOARD_VIEW, <LotDashboard />, { projectScoped: true })} />
          <Route path="reports" element={protect(PERMISSIONS.LOT_REPORTS_VIEW, <LotReports />, { projectScoped: true })} />
          <Route path="listings" element={protect(PERMISSIONS.LOT_LISTINGS_VIEW, <LotListings />, { projectScoped: true })} />
          <Route path="listings/:listingId" element={protect(PERMISSIONS.LOT_LISTING_PROFILE_VIEW, <LotListingProfile />, { projectScoped: true })} />
          <Route path="listings/:listingId/accounts/:accountId" element={protect(PERMISSIONS.LOT_LISTING_PROFILE_VIEW, <LotListingProfile />, { projectScoped: true })} />
          <Route path="payments-audit" element={protect(PERMISSIONS.LOT_PAYMENT_LOGS_VIEW, <LotPaymentLogs />, { projectScoped: true })} />
          <Route path="commissions" element={protect(PERMISSIONS.LOT_COMMISSIONS_VIEW, <LotCommission />, { projectScoped: true })} />
          <Route path="settings" element={protect(PERMISSIONS.LOT_SETTINGS_VIEW, <LotSettings />, { projectScoped: true })} />
        </Route>

        <Route path="/portal/lot-projects/:projectSlug/printouts/offer-to-buy" element={protect(PERMISSIONS.LOT_PRINTOUTS_USE, <OfferToBuyPrintPage />, { projectScoped: true })} />
        <Route path="/portal/lot-projects/:projectSlug/printouts/statement-of-account" element={protect(PERMISSIONS.LOT_PRINTOUTS_USE, <SOAPrintPage />, { projectScoped: true })} />
        <Route path="/portal/lot-projects/:projectSlug/printouts/acknowledgement-receipts" element={protect(PERMISSIONS.LOT_PRINTOUTS_USE, <PaymentAcknowledgementReceiptsPrintPage />, { projectScoped: true })} />
        <Route path="/portal/super_admin/accredited/proof-of-income/print" element={<Navigate to="/portal/accredited/proof-of-income/print" replace />} />
        <Route path="/portal/super_admin/accredited/proof-of-income/range/print" element={<Navigate to="/portal/accredited/proof-of-income/range/print" replace />} />
        <Route path="/portal/accredited/proof-of-income/print" element={protect(PERMISSIONS.SYSTEM_ACCREDITED_PRINT, <AccreditedSellerProofOfIncomePrintPage />)} />
        <Route path="/portal/accredited/proof-of-income/range/print" element={protect(PERMISSIONS.SYSTEM_ACCREDITED_PRINT, <AccreditedSellerIncomeRangePrintPage />)} />
        <Route path="/portal/lot-projects/:projectSlug/printouts/documents" element={protect(PERMISSIONS.LOT_PRINTOUTS_USE, <DocumentsPrintPage />, { projectScoped: true })} />
        <Route path="/portal/printouts/signed-receipts" element={protect(PERMISSIONS.LOT_PRINTOUTS_USE, <SignedReceiptsPrintPage />)} />
        <Route path="/portal/lot-projects/:projectSlug/price-list/print" element={protect(PERMISSIONS.SYSTEM_PROJECTS_PRINT_PRICE_LIST, <ProjectPriceListPrintPage />, { projectScoped: true })} />
        <Route path="/portal/reports/print" element={protect(PERMISSIONS.SYSTEM_REPORTS_EXPORT, <ReportsPrintPage />)} />
      </>
    )
  )

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-black text-slate-600">Loading workspace...</div>}>
      <RouterProvider router={router} />
    </Suspense>
  )
}

export default App

