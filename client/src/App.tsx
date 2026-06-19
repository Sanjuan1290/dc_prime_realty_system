import { 
  RouterProvider, 
  createBrowserRouter, 
  createRoutesFromElements, 
  Route 
} from "react-router-dom"

// Auth
import Login from "./auth/Login"

// Pages

const App = () => {
  
  const router = createBrowserRouter(createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />}/>

      <Route path="/" element={<p></p>}>
      </Route>
    </>
  ))
  return <RouterProvider router={router}/>
}

export default App