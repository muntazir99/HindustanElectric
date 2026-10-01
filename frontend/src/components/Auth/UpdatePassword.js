import React, { useState } from "react";
import axios from "../../api.js";

function UpdatePassword() {
  const [username, setUsername] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters long.");
      return;
    }
    try {
      const res = await axios.post("/auth/update_password", {
        username,
        old_password: oldPassword,
        new_password: newPassword,
      });
      setMessage(res.data.message);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to update password.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">Update Password</h2>
        <form onSubmit={handleUpdatePassword}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />
          <input
            type="password"
            placeholder="Old Password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />
          <button
            type="submit"
            className="w-full bg-yellow-500 text-white p-2 rounded"
          >
            Update Password
          </button>
        </form>
        {message && <p className="mt-4 text-center text-yellow-500">{message}</p>}
      </div>
    </div>
  );
}

export default UpdatePassword;
