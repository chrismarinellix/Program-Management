import React from "react";
import ReactDOM from "react-dom/client";
import GridConnectionDashboard from "./GridConnectionDashboard";
import { initDatabase } from "./services/database";
import "./index.css";

// Initialize database before app starts
async function initializeApp() {
  // Initialize SQLite database first
  try {
    await initDatabase();
    console.log('SQLite database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Continue anyway - app can work without SQL features
  }
  
  // Then render the app
  const rootElement = document.getElementById("root");
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <GridConnectionDashboard />
      </React.StrictMode>
    );
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already loaded
  initializeApp();
}
