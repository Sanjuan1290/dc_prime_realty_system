import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";
import Login from "./auth/Login";
import SystemLayout from "./layout/SystemLayout";
import Dashboard from "./pages/System/Dashboard";
import Documents from "./pages/System/Documents";
import SellerGroup from "./pages/System/SellerGroup";
import Users from './pages/System/Users'
import Accredited from './pages/System/Accredited'

const App = () => {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/" element={<Login />} />

        <Route path="/super_admin" element={<SystemLayout />}>
          <Route index element={<Dashboard />}/>
          <Route path="documents" element={<Documents />}/>
          <Route path="users" element={<Users />}/>
          <Route path="accredited" element={<Accredited />}/>
          <Route path="users/seller_group" element={<SellerGroup />}/>
          <Route path="documents" element={<Documents />}/>
        </Route>
      </>
    )
  );

  return <RouterProvider router={router} />;
};

export default App;
