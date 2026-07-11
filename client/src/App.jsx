import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from 'react-router-dom'

import Login from './auth/Login'
import ChangePassword from './auth/ChangePassword'
import AccessDenied from './auth/AccessDenied'
import AuthEventBridge from './auth/AuthEventBridge'
import ProtectedRoute from './auth/ProtectedRoute'
import { ADMIN_ROLES, SUPER_ADMIN_ROLES } from './auth/routeAccess'
import SystemLayout from './layout/SystemLayout'
import LotLayout from './layout/LotLayout'

import Dashboard from './pages/System/Dashboard'
import Documents from './pages/System/Documents'
import SellerGroup from './pages/System/SellerGroup'
import Users from './pages/System/Users'
import Accredited from './pages/System/Accredited'
import Projects from './pages/System/Projects'
import Notifications from './pages/System/Notifications'
import AuditLogs from './pages/System/AuditLogs'
import Settings from './pages/System/Settings'

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

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AuthEventBridge />}>
      <Route path="/" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/access-denied" element={<AccessDenied />} />

      <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
        <Route path="/super_admin" element={<SystemLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="documents" element={<Documents />} />
          <Route path="accredited" element={<Accredited />} />
          <Route path="users/seller_group" element={<SellerGroup />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="settings" element={<Settings />} />

          <Route element={<ProtectedRoute allowedRoles={SUPER_ADMIN_ROLES} />}>
            <Route path="users" element={<Users />} />
          </Route>
        </Route>

        <Route path="/lot-projects/:projectSlug" element={<LotLayout />}>
          <Route index element={<LotDashboard />} />
          <Route path="listings" element={<LotListings />} />
          <Route path="listings/:listingId" element={<LotListingProfile />} />
          <Route path="payments-audit" element={<LotPaymentLogs />} />
          <Route path="commissions" element={<LotCommission />} />
          <Route path="settings" element={<LotSettings />} />
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
          path="/lot-projects/:projectSlug/printouts/documents"
          element={<DocumentsPrintPage />}
        />
        <Route
          path="/lot-projects/:projectSlug/price-list/print"
          element={<ProjectPriceListPrintPage />}
        />
      </Route>
    </Route>
  )
)

const App = () => <RouterProvider router={router} />

export default App
