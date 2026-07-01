import { 
  RouterProvider, 
  createBrowserRouter, 
  createRoutesFromElements, 
  Route 
} from "react-router-dom"

// Auth
import Login from "./auth/Login"
// Pages
import SystemLayout from "./layouts/SystemLayout"
import Dashboard from "./pages/System/Dashboard"
import Users from "./pages/System/Users"
import Accredited from "./pages/System/Accredited"
import SellerGroup from "./pages/System/SellerGroup"

import Document from "./pages/System/Document"

import BailenLayout from "./layouts/BailenLayout"
import BailenDashboard from './pages/Bailen/Dashboard'
import BailenListings from "./pages/Bailen/Listings"
import BailenPayments from './pages/Bailen/Payments'
import BailenCommissions from './pages/Bailen/Commission'
import BailenSettings from './pages/Bailen/Settings'

const App = () => {
  
  const router = createBrowserRouter(createRoutesFromElements(
    <>
      <Route path="/" element={<Login />}/>

      <Route path="/super_admin" element={<SystemLayout />}>
        <Route index element={<Dashboard />}/>
        <Route path="documents" element={<Document />}/>
        <Route path="users" element={<Users />}/>
        <Route path="accredited" element={<Accredited />}/>
        <Route path="users/seller_group" element={<SellerGroup />}/>
      </Route>

      <Route path="/bailenProject" element={<BailenLayout />}>
        <Route index element={<BailenDashboard />} />
        <Route path="listings" element={<BailenListings />} />
        <Route path="payments" element={< BailenPayments/>} />
        <Route path="commissions" element={<BailenCommissions />} />
        <Route path="settings" element={<BailenSettings />} />
      </Route>
    </>
  ))
  return <RouterProvider router={router}/>
}

export default App