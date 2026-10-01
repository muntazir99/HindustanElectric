import React from "react";
import ReactDOM from "react-dom/client"; // Updated import for React 18
import App from "./App.js";


import "./index.css";
// Create root for React 18
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);