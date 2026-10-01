import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api.js";
import { useAuth } from "../../context/AuthContext.js";
import { Alert, Button, Field, Input } from "../../ui/index.js";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/auth/login", { username, password });
      if (response.data.success) {
        login(response.data.token);
        navigate("/dashboard");
      } else {
        setError("Invalid credentials, please try again.");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Login failed";
      setError(errorMsg);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">Hindustan Electric</h1>
          <p className="text-gray-600">Muzaffarpur</p>
        </div>
        <form onSubmit={handleLogin} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <Alert>{error}</Alert>
          <Field label="Username">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Button type="submit" variant="primary" className="w-full text-lg h-12" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </Button>
          <p className="text-center text-gray-600">Forgot your password? Ask the owner to reset it.</p>
        </form>
      </div>
    </div>
  );
}

export default Login;
