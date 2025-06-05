import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { PWAProvider } from "./contexts/PWAContext.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { initializeSession } from "./services/session.ts";

// Initialize session management
const sessionCleanup = initializeSession();

// Clean up session management when the page unloads
window.addEventListener("beforeunload", sessionCleanup);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PWAProvider>
          <App />
        </PWAProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
