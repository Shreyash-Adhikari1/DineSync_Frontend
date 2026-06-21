import { Navigate, Route, Routes } from "react-router-dom";
import CustomerShell from "./customer/CustomerShell.jsx";
import BusinessLogin from "./business/BusinessLogin.jsx";
import BusinessRegister from "./business/BusinessRegister.jsx";
import BusinessDashboard from "./business/BusinessDashboard.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/business/login" replace />} />
      <Route path="/join/:qrToken" element={<CustomerShell />} />
      <Route path="/session/:sessionId" element={<CustomerShell />} />
      <Route path="/business/login" element={<BusinessLogin />} />
      <Route path="/business/register" element={<BusinessRegister />} />
      <Route path="/business/dashboard/*" element={<BusinessDashboard />} />
    </Routes>
  );
}
