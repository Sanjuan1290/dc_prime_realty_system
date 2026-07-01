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
import Dashboard from "./pages/Shared/Dashboard"
import Document from "./pages/System/Document"

import BailenLayout from "./layouts/BailenLayout"
import BailenDashboard from './pages/Bailen/Dashboard'
import BailenListings from "./pages/Bailen/Listings"

const App = () => {
  
  const router = createBrowserRouter(createRoutesFromElements(
    <>
      <Route path="/" element={<Login />}/>

      <Route path="/super_admin" element={<SystemLayout />}>
        <Route index element={<Dashboard />}/>
        <Route path="documents" element={<Document />}/>
      </Route>

      <Route path="/bailenProject" element={<BailenLayout />}>
        <Route index element={<BailenDashboard />} />
        <Route path="listings" element={<BailenListings />} />
      </Route>
    </>
  ))
  return <RouterProvider router={router}/>
}

export default App