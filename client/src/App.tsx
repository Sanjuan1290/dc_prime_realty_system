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
import Dashboard from "./pages/Dashboard"
import Projects from "./pages/Projects"
import Listings from "./pages/Listings"


const App = () => {
  
  const router = createBrowserRouter(createRoutesFromElements(
    <>
      <Route path="/" element={<Login />}/>

      <Route path="/super_admin" element={<SystemLayout />}>
        <Route index element={<Dashboard />}/>
        <Route path="projects" element={<Projects />}/>
        <Route path="listings" element={<Listings />}/>
      </Route>
    </>
  ))
  return <RouterProvider router={router}/>
}

export default App