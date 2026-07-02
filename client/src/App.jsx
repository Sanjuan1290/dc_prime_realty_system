import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";
import SystemLayout from "./layout/SystemLayout";
import Login from "./auth/Login";
import Dashboard from "./pages/System/Dashboard";
import Documents from "./pages/System/Documents";



const App = () => {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/" element={<Login />} />

        <Route path="/super_admin" element={<SystemLayout />}>
          <Route index element={<Dashboard />}/>
          <Route path="documents" element={<Documents />}/>
        </Route>
      </>
    )
  );

  return <RouterProvider router={router} />;
};

export default App;
