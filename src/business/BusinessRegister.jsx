import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { businessApi } from "../api/business";
import { getErrorMessage } from "../api/http";
import { AuthShell } from "./BusinessLogin";

export default function BusinessRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: "",
    email: "",
    password: "",
    phoneNumber: "",
    address: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await businessApi.register(form);
      navigate("/business/login");
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create business account" subtitle="Set up your restaurant workspace.">
      <form onSubmit={submit} className="auth-form">
        <label>Business name<input value={form.businessName} onChange={(e) => setField("businessName", e.target.value)} required /></label>
        <label>Email<input value={form.email} onChange={(e) => setField("email", e.target.value)} type="email" required /></label>
        <label>Password<input value={form.password} onChange={(e) => setField("password", e.target.value)} type="password" minLength={8} required /></label>
        <label>Phone<input value={form.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} /></label>
        <label>Address<input value={form.address} onChange={(e) => setField("address", e.target.value)} /></label>
        {error && <div className="notice error">{error}</div>}
        <button className="primary-btn" disabled={loading}>{loading ? "Creating..." : "Create account"}</button>
        <p>Already registered? <Link to="/business/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
