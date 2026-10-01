// src/components/Auth/CreateUser.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api.js";

function CreateUser() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const res = await axios.post("/auth/create_user", { username, password, role });
      setMessage(res.data.message);
      setUsername("");
      setPassword("");
      setRole("user");
      // Optionally, navigate to another page after success:
      // navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create user");
    }
  };

  return (
    <div
      className="flex justify-center items-center min-h-screen p-6"
      style={{
        background: "#f3f4f6",
      }}
    >
      <div
        className="p-8 w-full max-w-md rounded-2xl text-white"
        style={{
          background: "#e0e0e0",
          boxShadow: "8px 8px 16px #bebebe, -8px -8px 16px #ffffff",
          backdropFilter: "blur(4px)",
        }}
      >
        <h2
          className="text-2xl font-bold mb-6 text-center"
          style={{ fontFamily: "Reospec", color: "#333" }}
        >
          Create User
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none"
              style={{
                background: "#e0e0e0",
                border: "1px solid rgba(255,255,255,0.3)",
                boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff",
              }}
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none"
              style={{
                background: "#e0e0e0",
                border: "1px solid rgba(255,255,255,0.3)",
                boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff",
              }}
            />
          </div>
          <div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-3 rounded-xl text-gray-800 focus:outline-none"
              style={{
                background: "#e0e0e0",
                border: "1px solid rgba(255,255,255,0.3)",
                boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff",
              }}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold transition-all hover:bg-green-600"
            style={{
              background: "#34d399",
              boxShadow: "8px 8px 16px #bebebe, -8px -8px 16px #ffffff",
            }}
          >
            Create User
          </button>
        </form>
        {error && <p className="mt-4 text-center text-red-500">{error}</p>}
        {message && <p className="mt-4 text-center text-green-500">{message}</p>}
      </div>
    </div>
  );
}

export default CreateUser;
