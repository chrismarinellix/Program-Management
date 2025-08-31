import React from "react";
import ReactDOM from "react-dom/client";
import GridConnectionDashboard from "./GridConnectionDashboard";
import "./index.css";

// Simple initialization without complex error handling
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <GridConnectionDashboard />
      </React.StrictMode>
    );
  }
});
