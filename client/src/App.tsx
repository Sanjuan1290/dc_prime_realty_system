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


const App = () => {
  
  const router = createBrowserRouter(createRoutesFromElements(
    <>
      <Route path="/" element={<Login />}/>

      <Route path="/super_admin" element={<SystemLayout />}>
        <Route index element={<Dashboard />}/>
      </Route>
    </>
  ))
  return <RouterProvider router={router}/>
}

export default App