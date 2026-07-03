import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from 'react-router-dom'
import Login from './auth/Login'
import SystemLayout from './layout/SystemLayout'
import BailenLayout from './layout/BailenLayout'
import SystemDashboard from './pages/System/Dashboard'
import Documents from './pages/System/Documents'
import SellerGroup from './pages/System/SellerGroup'
import Users from './pages/System/Users'
import Accredited from './pages/System/Accredited'
import BailenDashboard from './pages/BailenProject/Dashboard'
import Listings from './pages/BailenProject/Listings'
import ListingProfile from './pages/BailenProject/ListingProfile'
import Payment from './pages/BailenProject/Payment'
import PaymentLogs from './pages/BailenProject/PaymentLogs'
import Commission from './pages/BailenProject/Commission'
import BailenSettings from './pages/BailenProject/Settings'

const App = () => {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/" element={<Login />} />

        <Route path="/super_admin" element={<SystemLayout />}>
          <Route index element={<SystemDashboard />} />
          <Route path="documents" element={<Documents />} />
          <Route path="users" element={<Users />} />
          <Route path="accredited" element={<Accredited />} />
          <Route path="users/seller_group" element={<SellerGroup />} />
        </Route>

        <Route path="/bailenProject" element={<BailenLayout />}>
          <Route index element={<BailenDashboard />} />
          <Route path="listings" element={<Listings />} />
          <Route path="listings/:listingId" element={<ListingProfile />} />
          <Route path="payments" element={<Payment />} />
          <Route path="payment-logs" element={<PaymentLogs />} />
          <Route path="commissions" element={<Commission />} />
          <Route path="settings" element={<BailenSettings />} />
        </Route>
      </>
    )
  )

  return <RouterProvider router={router} />
}

export default App
