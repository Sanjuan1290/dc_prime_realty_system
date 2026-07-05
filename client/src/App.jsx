import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";
import Login from "./auth/Login";
import SystemLayout from "./layout/SystemLayout";
import BailenLayout from "./layout/BailenLayout";

import Dashboard from "./pages/System/Dashboard";
import Documents from "./pages/System/Documents";
import SellerGroup from "./pages/System/SellerGroup";
import Users from "./pages/System/Users";
import Accredited from "./pages/System/Accredited";

import BailenDashboard from "./pages/Lot_Projects/Dashboard";
import BailenListings from "./pages/Lot_Projects/Listings";
import BailenListingProfile from "./pages/Lot_Projects/ListingProfile";
import BailenPaymentLogs from "./pages/Lot_Projects/PaymentLogs";
import BailenCommission from "./pages/Lot_Projects/Commission";
import BailenSettings from "./pages/Lot_Projects/Settings";
import Projects from "./pages/System/Projects";

import OfferToBuyPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyPrintPage'
import SOAPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/SOAPrintPage'
import DocumentsPrintPage from './components/Lot_Projects/ListingProfileComponents/Printouts/DocumentsPrintPage'

const App = () => {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/" element={<Login />} />

        <Route path="/super_admin" element={<SystemLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="documents" element={<Documents />} />
          <Route path="users" element={<Users />} />
          <Route path="accredited" element={<Accredited />} />
          <Route path="users/seller_group" element={<SellerGroup />} />
        </Route>

        <Route path="/Bailen-Lot-Project" element={<BailenLayout />}>
          <Route index element={<BailenDashboard />} />
          <Route path="listings" element={<BailenListings />} />
          <Route path="listings/:listingId" element={<BailenListingProfile />} />
          <Route path="payments-audit" element={<BailenPaymentLogs />} />
          <Route path="commissions" element={<BailenCommission />} />
          <Route path="settings" element={<BailenSettings />} />
        </Route>

        <Route
          path="/Bailen-Lot-Project/printouts/offer-to-buy"
          element={<OfferToBuyPrintPage />}
        />
        <Route
          path="/Bailen-Lot-Project/printouts/statement-of-account"
          element={<SOAPrintPage />}
        />
        <Route
          path="/Bailen-Lot-Project/printouts/documents"
          element={<DocumentsPrintPage />}
        />
      </>
    )
  );

  return <RouterProvider router={router} />;
};

export default App;
