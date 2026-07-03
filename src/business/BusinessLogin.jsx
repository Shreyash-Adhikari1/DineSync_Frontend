import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { businessApi } from "../api/business";
import { getErrorMessage } from "../api/http";

export default function BusinessLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await businessApi.login(email, password);
      navigate("/business/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Manage tables, orders, bills and payments.">
      <form onSubmit={submit} className="auth-form">
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
        <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></label>
        {error && <div className="notice error">{error}</div>}
        <button className="primary-btn" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        <p>New business? <Link to="/business/register">Create an account</Link></p>
      </form>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <main className="auth-page">
      <section>
        <div className="brand dark">Dine<span>Sync</span></div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
